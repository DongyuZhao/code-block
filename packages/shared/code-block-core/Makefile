# Thin wrapper over the CMake build. CMake is the source of truth (it is also
# what the Android NDK externalNativeBuild consumes); this Makefile just keeps
# `make test` / `make cli` convenient for local work.

BUILD_DIR := build

.PHONY: all test bench cli queries wasm clean

all: $(BUILD_DIR)
	cmake --build $(BUILD_DIR) -j

$(BUILD_DIR):
	cmake -S . -B $(BUILD_DIR) -DCMAKE_BUILD_TYPE=Release

# Regenerate the embedded highlight queries from the vendored .scm files.
queries:
	node gen/gen-queries.mjs

# Compile the core to a single-file wasm ES module (requires Emscripten on PATH)
# and publish it into the React package.
wasm:
	node gen/build-wasm.mjs

test: all
	ctest --test-dir $(BUILD_DIR) --output-on-failure

bench: all
	sh test/benchmark_scaling.sh $(BUILD_DIR)/cb_cli

cli: all
	@echo "built $(BUILD_DIR)/cb_cli"

clean:
	rm -rf $(BUILD_DIR)
