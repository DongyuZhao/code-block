cmake_minimum_required(VERSION 3.13)
project(code_block_core C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR})
set(TS_DIR ${CORE_DIR}/vendor/tree-sitter)
set(GRAMMARS_DIR ${CORE_DIR}/vendor/grammars)

# --- tree-sitter runtime (amalgamated) -----------------------------------
add_library(tree_sitter_runtime OBJECT ${TS_DIR}/src/lib.c)
target_include_directories(tree_sitter_runtime PRIVATE ${TS_DIR}/include ${TS_DIR}/src)
target_compile_options(tree_sitter_runtime PRIVATE -w)

# --- vendored grammars ---------------------------------------------------
# Each grammar compiles against its OWN bundled tree_sitter/parser.h to avoid
# cross-grammar header collisions; scanners resolve relative includes from
# their own source directory.
function(cb_add_grammar target include_dir)
  add_library(${target} OBJECT ${ARGN})
  target_include_directories(${target} PRIVATE ${include_dir} ${TS_DIR}/include)
  target_compile_options(${target} PRIVATE -w)
endfunction()

cb_add_grammar(cb_grammar_typescript ${GRAMMARS_DIR}/typescript/typescript/src
  ${GRAMMARS_DIR}/typescript/typescript/src/parser.c
  ${GRAMMARS_DIR}/typescript/typescript/src/scanner.c)
cb_add_grammar(cb_grammar_tsx ${GRAMMARS_DIR}/typescript/tsx/src
  ${GRAMMARS_DIR}/typescript/tsx/src/parser.c
  ${GRAMMARS_DIR}/typescript/tsx/src/scanner.c)
cb_add_grammar(cb_grammar_javascript ${GRAMMARS_DIR}/javascript/src
  ${GRAMMARS_DIR}/javascript/src/parser.c
  ${GRAMMARS_DIR}/javascript/src/scanner.c)
cb_add_grammar(cb_grammar_python ${GRAMMARS_DIR}/python/src
  ${GRAMMARS_DIR}/python/src/parser.c
  ${GRAMMARS_DIR}/python/src/scanner.c)
cb_add_grammar(cb_grammar_kotlin ${GRAMMARS_DIR}/kotlin/src
  ${GRAMMARS_DIR}/kotlin/src/parser.c
  ${GRAMMARS_DIR}/kotlin/src/scanner.c)
# Swift ships parser.c plus parser_abi13/14 variants; compile only parser.c.
cb_add_grammar(cb_grammar_swift ${GRAMMARS_DIR}/swift/src
  ${GRAMMARS_DIR}/swift/src/parser.c
  ${GRAMMARS_DIR}/swift/src/scanner.c)
cb_add_grammar(cb_grammar_bash ${GRAMMARS_DIR}/bash/src
  ${GRAMMARS_DIR}/bash/src/parser.c
  ${GRAMMARS_DIR}/bash/src/scanner.c)
cb_add_grammar(cb_grammar_c ${GRAMMARS_DIR}/c/src
  ${GRAMMARS_DIR}/c/src/parser.c)
cb_add_grammar(cb_grammar_css ${GRAMMARS_DIR}/css/src
  ${GRAMMARS_DIR}/css/src/parser.c
  ${GRAMMARS_DIR}/css/src/scanner.c)
cb_add_grammar(cb_grammar_go ${GRAMMARS_DIR}/go/src
  ${GRAMMARS_DIR}/go/src/parser.c)
cb_add_grammar(cb_grammar_html ${GRAMMARS_DIR}/html/src
  ${GRAMMARS_DIR}/html/src/parser.c
  ${GRAMMARS_DIR}/html/src/scanner.c)
cb_add_grammar(cb_grammar_java ${GRAMMARS_DIR}/java/src
  ${GRAMMARS_DIR}/java/src/parser.c)
cb_add_grammar(cb_grammar_json ${GRAMMARS_DIR}/json/src
  ${GRAMMARS_DIR}/json/src/parser.c)
cb_add_grammar(cb_grammar_markdown ${GRAMMARS_DIR}/markdown/src
  ${GRAMMARS_DIR}/markdown/src/parser.c
  ${GRAMMARS_DIR}/markdown/src/scanner.c)
cb_add_grammar(cb_grammar_markdown_inline ${GRAMMARS_DIR}/markdown-inline/src
  ${GRAMMARS_DIR}/markdown-inline/src/parser.c
  ${GRAMMARS_DIR}/markdown-inline/src/scanner.c)
cb_add_grammar(cb_grammar_ruby ${GRAMMARS_DIR}/ruby/src
  ${GRAMMARS_DIR}/ruby/src/parser.c
  ${GRAMMARS_DIR}/ruby/src/scanner.c)
cb_add_grammar(cb_grammar_rust ${GRAMMARS_DIR}/rust/src
  ${GRAMMARS_DIR}/rust/src/parser.c
  ${GRAMMARS_DIR}/rust/src/scanner.c)

set(CB_GRAMMAR_OBJECTS
  $<TARGET_OBJECTS:tree_sitter_runtime>
  $<TARGET_OBJECTS:cb_grammar_typescript>
  $<TARGET_OBJECTS:cb_grammar_tsx>
  $<TARGET_OBJECTS:cb_grammar_javascript>
  $<TARGET_OBJECTS:cb_grammar_python>
  $<TARGET_OBJECTS:cb_grammar_kotlin>
  $<TARGET_OBJECTS:cb_grammar_swift>
  $<TARGET_OBJECTS:cb_grammar_bash>
  $<TARGET_OBJECTS:cb_grammar_c>
  $<TARGET_OBJECTS:cb_grammar_css>
  $<TARGET_OBJECTS:cb_grammar_go>
  $<TARGET_OBJECTS:cb_grammar_html>
  $<TARGET_OBJECTS:cb_grammar_java>
  $<TARGET_OBJECTS:cb_grammar_json>
  $<TARGET_OBJECTS:cb_grammar_markdown>
  $<TARGET_OBJECTS:cb_grammar_markdown_inline>
  $<TARGET_OBJECTS:cb_grammar_ruby>
  $<TARGET_OBJECTS:cb_grammar_rust>)

# --- core library --------------------------------------------------------
add_library(code_block_core STATIC ${CORE_DIR}/src/code_block_core.c ${CB_GRAMMAR_OBJECTS})
target_include_directories(code_block_core
  PUBLIC ${CORE_DIR}/include
  PRIVATE ${TS_DIR}/include ${CORE_DIR}/src)
target_compile_options(code_block_core PRIVATE -Wall -Wextra)

# --- CLI + tests (skipped when consumed as a subdirectory, e.g. Android) --
if(CMAKE_PROJECT_NAME STREQUAL "code_block_core" AND NOT ANDROID)
  add_executable(cb_cli ${CORE_DIR}/gen/cb_cli.c)
  target_link_libraries(cb_cli PRIVATE code_block_core)

  enable_testing()
  add_executable(cb_core_test ${CORE_DIR}/test/core_test.c)
  target_link_libraries(cb_core_test PRIVATE code_block_core)
  add_test(NAME cb_core_test COMMAND cb_core_test)
endif()

if(CB_BUILD_JNI)
  add_library(code_block_core_jni SHARED ${CORE_DIR}/src/code_block_core_jni.c)
  target_link_libraries(code_block_core_jni PRIVATE code_block_core)
  target_include_directories(code_block_core_jni PRIVATE ${CORE_DIR}/include)
endif()
