#include <jni.h>
#include <stdlib.h>

#include "code_block_core.h"

JNIEXPORT jstring JNICALL
Java_io_github_dongyuzhao_composecodeblock_NativeCodeHighlighter_nativeTokenize(
    JNIEnv *env,
    jobject thiz,
    jstring code,
    jstring language,
    jstring fallback_language) {
  (void)thiz;

  const char *code_utf = (*env)->GetStringUTFChars(env, code, NULL);
  const char *language_utf = (*env)->GetStringUTFChars(env, language, NULL);
  const char *fallback_utf = (*env)->GetStringUTFChars(env, fallback_language, NULL);

  if (!code_utf || !language_utf || !fallback_utf) {
    if (code_utf) {
      (*env)->ReleaseStringUTFChars(env, code, code_utf);
    }
    if (language_utf) {
      (*env)->ReleaseStringUTFChars(env, language, language_utf);
    }
    if (fallback_utf) {
      (*env)->ReleaseStringUTFChars(env, fallback_language, fallback_utf);
    }
    return NULL;
  }

  char *json = cb_tokenize_json(code_utf, language_utf, fallback_utf);

  (*env)->ReleaseStringUTFChars(env, code, code_utf);
  (*env)->ReleaseStringUTFChars(env, language, language_utf);
  (*env)->ReleaseStringUTFChars(env, fallback_language, fallback_utf);

  if (!json) {
    return NULL;
  }

  jstring result = (*env)->NewStringUTF(env, json);
  cb_string_free(json);
  return result;
}
