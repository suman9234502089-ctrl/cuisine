CXX = clang++
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra -pthread
TARGET = dining_server
SRC = server.cpp
PORT ?= 8080

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET)

run: $(TARGET)
	./$(TARGET) $(PORT) ./public

clean:
	rm -f $(TARGET)

.PHONY: all run clean
