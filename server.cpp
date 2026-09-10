#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <thread>
#include <mutex>
#include <chrono>
#include <algorithm>
#include <cstring>
#include <cstdlib>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <fcntl.h>

// Simple JSON utility helpers
std::string readFile(const std::string& filepath) {
    std::ifstream file(filepath, std::ios::in | std::ios::binary);
    if (!file.is_open()) return "";
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

std::string getMimeType(const std::string& path) {
    if (path.rfind(".html") != std::string::npos) return "text/html; charset=utf-8";
    if (path.rfind(".css") != std::string::npos) return "text/css; charset=utf-8";
    if (path.rfind(".js") != std::string::npos) return "application/javascript; charset=utf-8";
    if (path.rfind(".json") != std::string::npos) return "application/json; charset=utf-8";
    if (path.rfind(".svg") != std::string::npos) return "image/svg+xml";
    if (path.rfind(".png") != std::string::npos) return "image/png";
    if (path.rfind(".jpg") != std::string::npos || path.rfind(".jpeg") != std::string::npos) return "image/jpeg";
    if (path.rfind(".ico") != std::string::npos) return "image/x-icon";
    return "text/plain; charset=utf-8";
}

std::string urlDecode(const std::string& in) {
    std::string out;
    for (size_t i = 0; i < in.length(); ++i) {
        if (in[i] == '%') {
            if (i + 2 < in.length()) {
                int value = 0;
                std::istringstream hex_stream(in.substr(i + 1, 2));
                if (hex_stream >> std::hex >> value) {
                    out += static_cast<char>(value);
                    i += 2;
                } else {
                    out += in[i];
                }
            }
        } else if (in[i] == '+') {
            out += ' ';
        } else {
            out += in[i];
        }
    }
    return out;
}

std::map<std::string, std::string> parseQueryParams(const std::string& query) {
    std::map<std::string, std::string> params;
    std::istringstream stream(query);
    std::string pair;
    while (std::getline(stream, pair, '&')) {
        size_t eq = pair.find('=');
        if (eq != std::string::npos) {
            std::string key = urlDecode(pair.substr(0, eq));
            std::string val = urlDecode(pair.substr(eq + 1));
            params[key] = val;
        } else if (!pair.empty()) {
            params[urlDecode(pair)] = "";
        }
    }
    return params;
}

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::tolower(c); });
    return s;
}

class DiningServer {
private:
    int serverFd;
    int port;
    std::string publicDir;
    std::string cachedJsonData;
    std::mutex dataMutex;

public:
    DiningServer(int p, const std::string& dir) : port(p), publicDir(dir) {
        cachedJsonData = readFile(publicDir + "/data.json");
        if (cachedJsonData.empty()) {
            std::cerr << "[Warning] data.json not found in " << publicDir << std::endl;
        } else {
            std::cout << "[Info] Loaded data.json (" << cachedJsonData.size() << " bytes)" << std::endl;
        }
    }

    void start() {
        serverFd = socket(AF_INET, SOCK_STREAM, 0);
        if (serverFd < 0) {
            perror("Socket creation failed");
            exit(EXIT_FAILURE);
        }

        int opt = 1;
        setsockopt(serverFd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        sockaddr_in address{};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port);

        if (bind(serverFd, (struct sockaddr*)&address, sizeof(address)) < 0) {
            perror("Socket bind failed");
            exit(EXIT_FAILURE);
        }

        if (listen(serverFd, 32) < 0) {
            perror("Listen failed");
            exit(EXIT_FAILURE);
        }

        std::cout << "==========================================================" << std::endl;
        std::cout << "  SavorSphere C++ Dining Web Server & REST API Running!  " << std::endl;
        std::cout << "  Port:    " << port << std::endl;
        std::cout << "  Root:    http://localhost:" << port << "/" << std::endl;
        std::cout << "  API:     http://localhost:" << port << "/api/dining" << std::endl;
        std::cout << "  Filters: http://localhost:" << port << "/api/filters" << std::endl;
        std::cout << "==========================================================" << std::endl;

        while (true) {
            sockaddr_in clientAddr{};
            socklen_t clientLen = sizeof(clientAddr);
            int clientFd = accept(serverFd, (struct sockaddr*)&clientAddr, &clientLen);
            if (clientFd < 0) {
                continue;
            }
            std::thread(&DiningServer::handleClient, this, clientFd).detach();
        }
    }

private:
    void sendResponse(int clientFd, int statusCode, const std::string& statusText,
                      const std::string& contentType, const std::string& body) {
        std::ostringstream response;
        response << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n";
        response << "Content-Type: " << contentType << "\r\n";
        response << "Content-Length: " << body.size() << "\r\n";
        response << "Access-Control-Allow-Origin: *\r\n";
        response << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
        response << "Access-Control-Allow-Headers: Content-Type\r\n";
        response << "Connection: close\r\n\r\n";
        response << body;

        std::string resStr = response.str();
        send(clientFd, resStr.c_str(), resStr.size(), 0);
        close(clientFd);
    }

    void handleClient(int clientFd) {
        char buffer[8192];
        ssize_t bytesRead = recv(clientFd, buffer, sizeof(buffer) - 1, 0);
        if (bytesRead <= 0) {
            close(clientFd);
            return;
        }
        buffer[bytesRead] = '\0';
        std::string request(buffer);

        std::istringstream reqStream(request);
        std::string method, fullPath, httpVersion;
        reqStream >> method >> fullPath >> httpVersion;

        // Parse query string if present
        std::string path = fullPath;
        std::string queryString = "";
        size_t qPos = fullPath.find('?');
        if (qPos != std::string::npos) {
            path = fullPath.substr(0, qPos);
            queryString = fullPath.substr(qPos + 1);
        }

        std::cout << "[" << method << "] " << path << (queryString.empty() ? "" : ("?" + queryString)) << std::endl;

        if (method == "OPTIONS") {
            sendResponse(clientFd, 204, "No Content", "text/plain", "");
            return;
        }

        // Handle REST API: GET /api/dining
        if (path == "/api/dining" && method == "GET") {
            handleApiDining(clientFd, queryString);
            return;
        }

        // Handle REST API: GET /api/filters
        if (path == "/api/filters" && method == "GET") {
            std::string filterMeta = R"JSON({
  "traditions": [
    {"id": "all", "label": "All Traditions"},
    {"id": "ancestral", "label": "Ancestral Heritage", "icon": "🏮"},
    {"id": "contemporary", "label": "Contemporary Fusion", "icon": "✨"},
    {"id": "street_food", "label": "Street Food & Night Market", "icon": "🔥"},
    {"id": "ceremonial", "label": "Ceremonial & Feasts", "icon": "👑"}
  ],
  "cuisines": [
    {"id": "all", "label": "All Cuisines"},
    {"id": "japanese", "label": "Japanese", "icon": "🍱"},
    {"id": "italian", "label": "Italian", "icon": "🍝"},
    {"id": "indian", "label": "Indian", "icon": "🍛"},
    {"id": "mexican", "label": "Mexican", "icon": "🌮"},
    {"id": "mediterranean", "label": "Mediterranean", "icon": "🫒"},
    {"id": "french", "label": "French", "icon": "🥐"},
    {"id": "asian", "label": "Pan-Asian", "icon": "🥟"},
    {"id": "thai", "label": "Thai", "icon": "🍜"},
    {"id": "spanish", "label": "Spanish", "icon": "🥘"}
  ],
  "ageGroups": [
    {"id": "all", "label": "All Demographics"},
    {"id": "families", "label": "Kids & Families", "badge": "Family Friendly", "icon": "👨‍👩‍👧‍👦"},
    {"id": "young_adults", "label": "Young Adults (18-35)", "badge": "High Energy & Vibes", "icon": "🍸"},
    {"id": "romantic", "label": "Romantic Couples", "badge": "Intimate & Elegant", "icon": "🕯️"},
    {"id": "seniors", "label": "Seniors & Multi-Gen", "badge": "Relaxed & Accessible", "icon": "🍵"},
    {"id": "all_ages", "label": "All Ages Welcome", "badge": "Universal Feasting", "icon": "✨"}
  ]
})JSON";
            sendResponse(clientFd, 200, "OK", "application/json", filterMeta);
            return;
        }

        // Handle REST API: POST /api/reserve
        if (path == "/api/reserve" && method == "POST") {
            handleApiReserve(clientFd, request);
            return;
        }

        // Handle Static File Serving
        handleStaticFile(clientFd, path);
    }

    void handleApiDining(int clientFd, const std::string& queryString) {
        std::lock_guard<std::mutex> lock(dataMutex);
        if (cachedJsonData.empty()) {
            cachedJsonData = readFile(publicDir + "/data.json");
        }

        if (queryString.empty()) {
            sendResponse(clientFd, 200, "OK", "application/json", cachedJsonData);
            return;
        }

        auto params = parseQueryParams(queryString);
        std::string filterTradition = params.count("tradition") ? toLower(params["tradition"]) : "";
        std::string filterCuisine = params.count("cuisine") ? toLower(params["cuisine"]) : "";
        std::string filterAgeGroup = params.count("age_group") ? toLower(params["age_group"]) : "";
        std::string filterSearch = params.count("search") ? toLower(params["search"]) : "";

        // If no meaningful filters are applied, return full json
        if ((filterTradition.empty() || filterTradition == "all") &&
            (filterCuisine.empty() || filterCuisine == "all") &&
            (filterAgeGroup.empty() || filterAgeGroup == "all") &&
            filterSearch.empty()) {
            sendResponse(clientFd, 200, "OK", "application/json", cachedJsonData);
            return;
        }

        // Parse restaurants JSON array and filter
        // Standard JSON array splitting based on object boundaries
        std::vector<std::string> filtered;
        size_t pos = 0;
        while ((pos = cachedJsonData.find("{\n    \"id\":", pos)) != std::string::npos ||
               (pos = cachedJsonData.find("{\n  \"id\":", pos)) != std::string::npos ||
               (pos = cachedJsonData.find("{\"id\":", pos)) != std::string::npos) {
            size_t start = pos;
            int braceCount = 0;
            size_t i = start;
            for (; i < cachedJsonData.size(); ++i) {
                if (cachedJsonData[i] == '{') braceCount++;
                else if (cachedJsonData[i] == '}') {
                    braceCount--;
                    if (braceCount == 0) {
                        break;
                    }
                }
            }
            if (braceCount == 0 && i < cachedJsonData.size()) {
                std::string objStr = cachedJsonData.substr(start, i - start + 1);
                std::string lowerObj = toLower(objStr);

                bool matches = true;

                if (!filterTradition.empty() && filterTradition != "all") {
                    if (lowerObj.find("\"traditioncategory\": \"" + filterTradition + "\"") == std::string::npos &&
                        lowerObj.find("\"traditioncategory\":\"" + filterTradition + "\"") == std::string::npos &&
                        lowerObj.find(filterTradition) == std::string::npos) {
                        matches = false;
                    }
                }

                if (matches && !filterCuisine.empty() && filterCuisine != "all") {
                    if (lowerObj.find("\"cuisinecode\": \"" + filterCuisine + "\"") == std::string::npos &&
                        lowerObj.find("\"cuisinecode\":\"" + filterCuisine + "\"") == std::string::npos &&
                        lowerObj.find(filterCuisine) == std::string::npos) {
                        matches = false;
                    }
                }

                if (matches && !filterAgeGroup.empty() && filterAgeGroup != "all") {
                    if (lowerObj.find("\"agegroupcode\": \"" + filterAgeGroup + "\"") == std::string::npos &&
                        lowerObj.find("\"agegroupcode\":\"" + filterAgeGroup + "\"") == std::string::npos &&
                        lowerObj.find(filterAgeGroup) == std::string::npos) {
                        matches = false;
                    }
                }

                if (matches && !filterSearch.empty()) {
                    if (lowerObj.find(filterSearch) == std::string::npos) {
                        matches = false;
                    }
                }

                if (matches) {
                    filtered.push_back(objStr);
                }

                pos = i + 1;
            } else {
                break;
            }
        }

        std::ostringstream outJson;
        outJson << "[\n";
        for (size_t k = 0; k < filtered.size(); ++k) {
            outJson << filtered[k];
            if (k + 1 < filtered.size()) outJson << ",\n";
        }
        outJson << "\n]";

        sendResponse(clientFd, 200, "OK", "application/json", outJson.str());
    }

    void handleApiReserve(int clientFd, const std::string& rawRequest) {
        // Find body after \r\n\r\n
        size_t bodyPos = rawRequest.find("\r\n\r\n");
        std::string body = (bodyPos != std::string::npos) ? rawRequest.substr(bodyPos + 4) : "";

        // Generate pseudo confirmation code
        auto now = std::chrono::system_clock::now().time_since_epoch().count();
        long codeNum = std::abs((long)(now % 90000)) + 10000;
        std::string bookingRef = "SAVOR-" + std::to_string(codeNum);

        std::ostringstream response;
        response << "{\n"
                 << "  \"status\": \"confirmed\",\n"
                 << "  \"bookingReference\": \"" << bookingRef << "\",\n"
                 << "  \"message\": \"Your heritage dining table has been reserved with honor.\",\n"
                 << "  \"timestamp\": " << now << "\n"
                 << "}";

        sendResponse(clientFd, 200, "OK", "application/json", response.str());
    }

    void handleStaticFile(int clientFd, std::string path) {
        if (path == "/" || path.empty()) {
            path = "/index.html";
        }

        // Prevent path traversal
        if (path.find("..") != std::string::npos) {
            sendResponse(clientFd, 403, "Forbidden", "text/plain", "Forbidden");
            return;
        }

        std::string fullPath = publicDir + path;
        std::string content = readFile(fullPath);

        if (content.empty()) {
            // Check if it's missing extension, or index fallback
            std::string fallback = readFile(publicDir + "/index.html");
            if (!fallback.empty()) {
                sendResponse(clientFd, 200, "OK", "text/html; charset=utf-8", fallback);
                return;
            }
            sendResponse(clientFd, 404, "Not Found", "text/plain", "404 Not Found");
            return;
        }

        std::string mime = getMimeType(path);
        sendResponse(clientFd, 200, "OK", mime, content);
    }
};

int main(int argc, char* argv[]) {
    int port = 8080;
    std::string dir = "./public";

    if (argc > 1) {
        port = std::atoi(argv[1]);
    }
    if (argc > 2) {
        dir = argv[2];
    }

    DiningServer server(port, dir);
    server.start();

    return 0;
}
