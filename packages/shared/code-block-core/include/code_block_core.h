#ifndef CODE_BLOCK_CORE_H
#define CODE_BLOCK_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

char *cb_tokenize_json(const char *code, const char *language, const char *fallback_language);
void cb_string_free(char *value);

#ifdef __cplusplus
}
#endif

#endif
