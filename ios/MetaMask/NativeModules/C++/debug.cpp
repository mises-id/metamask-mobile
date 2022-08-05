//===-------------------------- debug.cpp ---------------------------------===//
//
// Part of the LLVM Project, under the Apache License v2.0 with LLVM Exceptions.
// See https://llvm.org/LICENSE.txt for license information.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//

#include "__config"
#include "__debug"
#include "functional"
#include "algorithm"
#include "string"
#include "cstdio"
#include "__hash_table"
#ifndef _LIBCPP_HAS_NO_THREADS
#include "mutex"
#if defined(__ELF__) && defined(_LIBCPP_LINK_PTHREAD_LIB)
#pragma comment(lib, "pthread")
#endif
#endif

_LIBCPP_BEGIN_NAMESPACE_STD

std::string __libcpp_debug_info::what() const {
  string msg = __file_;
  msg += ":" + to_string(__line_) + ": _LIBCPP_ASSERT '";
  msg += __pred_;
  msg += "' failed. ";
  msg += __msg_;
  return msg;
}
_LIBCPP_NORETURN void __libcpp_abort_debug_function(__libcpp_debug_info const& info) {
    std::fprintf(stderr, "%s\n", info.what().c_str());
    std::abort();
}

_LIBCPP_SAFE_STATIC __libcpp_debug_function_type
    __libcpp_debug_function = __libcpp_abort_debug_function;

bool __libcpp_set_debug_function(__libcpp_debug_function_type __func) {
  __libcpp_debug_function = __func;
  return true;
}


_LIBCPP_END_NAMESPACE_STD
