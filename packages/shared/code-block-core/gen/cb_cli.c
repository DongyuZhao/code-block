/* Thin CLI over the core: reads source code from stdin, tokenizes it, and
 * writes the {language, tokens:[{text,scope}]} JSON to stdout.
 *
 *   cb_cli <language> [fallback_language] < input.code
 *
 * Used by gen-goldens.mjs to regenerate the shared token-stream goldens. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "code_block_core.h"

int main(int argc, char **argv) {
    const char *language = argc > 1 ? argv[1] : "";
    const char *fallback = argc > 2 ? argv[2] : "";

    size_t capacity = 4096;
    size_t length = 0;
    char *code = (char *)malloc(capacity);
    if (code == NULL) {
        return 1;
    }
    size_t got;
    char chunk[4096];
    while ((got = fread(chunk, 1, sizeof(chunk), stdin)) > 0) {
        if (length + got + 1 > capacity) {
            while (length + got + 1 > capacity) capacity *= 2;
            char *next = (char *)realloc(code, capacity);
            if (next == NULL) {
                free(code);
                return 1;
            }
            code = next;
        }
        memcpy(code + length, chunk, got);
        length += got;
    }
    code[length] = '\0';

    char *json = cb_tokenize_json(code, language, fallback);
    free(code);
    if (json == NULL) {
        return 1;
    }
    fputs(json, stdout);
    cb_string_free(json);
    return 0;
}
