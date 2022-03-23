#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

# Default version must come first.
SSH_VERSIONS=( 8.8 8.6 )

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

DEBUG=0

# pnacl tries to use "python" instead of "python2".
export PNACLPYTHON=python2
python2 --version >/dev/null

for i in $@; do
  case $i in
    "--debug")
      DEBUG=1
      ;;

    *)
      echo "usage: $0 [--debug]"
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")"
mkdir -p output

# Build the toolchain packages.
pkgs=(
  # Build tools.
  gnuconfig
  mandoc
  bazel-0.17

  # NaCl toolchain.
  naclsdk
  glibc-compat

  # WASM toolchain.
  binaryen
  wabt
  wasi-sdk
  wasmtime
)
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build
done

# The plugin packages.
pkgs=(
  zlib
  openssl
  ldns
  $(printf 'openssh-%s ' "${SSH_VERSIONS[@]}")
)

# Build the NaCl packages.
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build --toolchain pnacl
done
./third_party/mosh-chrome/build

./wassh-libc-sup/build
# Build the WASM packages.
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build --toolchain wasm
done

# Install the WASM programs.
#
# We use -O2 as that seems to provide good enough shrinkage.  -O3/-O4 take
# much longer but don't produce singificnatly larger/smaller files.  -Os/-Oz
# also aren't that much smaller than -O2.  So use this pending more testing.
WASM_OPTS=()
if [[ ${DEBUG} == 1 ]]; then
  WASM_OPTS+=( -O0 )
else
  WASM_OPTS+=( -O2 )
fi

pushd output >/dev/null
cat <<EOF >Makefile.wasm-opt
# Only use single core because versions <102 are known to segfault, and upstream
# doesn't seem to have any idea if they actually fixed it, or if it just happens
# to mostly work now.
# https://github.com/WebAssembly/binaryen/issues/2273
#
# Also force single core because it significantly outperforms multicore runs due
# to some extreme internal threading overhead.
# https://github.com/WebAssembly/binaryen/issues/2740
export BINARYEN_CORES = 1

# Disable implicit rules we don't need.
MAKEFLAGS += --no-builtin-rules
.SUFFIXES:

WASM_OPTS = ${WASM_OPTS[*]}

WASM_OPT = ${PWD}/bin/wasm-opt

all:
EOF
first="true"
for version in "${SSH_VERSIONS[@]}"; do
  if [[ "${first}" == "true" ]]; then
    first=
    dir="plugin/wasm"
  else
    dir+="-openssh-${version}"
  fi
  mkdir -p "${dir}"

  for prog in scp sftp ssh ssh-keygen; do
    (
      echo "all: ${dir}/${prog}.wasm"
      echo "${dir}/${prog}.wasm:" \
        build/wasm/openssh-${version}*/work/openssh-*/${prog}
      printf '\t$(WASM_OPT) ${WASM_OPTS} $< -o $@\n'
    ) >>Makefile.wasm-opt
  done
done
make -f Makefile.wasm-opt -j${ncpus} -O
popd >/dev/null

# Build the PNaCl programs.
BUILD_ARGS=()
if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS+=( DEBUG=1 )
  tarname="debug.tar"
else
  tarname="release.tar"
fi

first="true"
for version in "${SSH_VERSIONS[@]}"; do
  make -C src -j${ncpus} "${BUILD_ARGS[@]}" \
    SSH_VERSION="${version}" DEFAULT_VERSION="${first}"
  first=
done

cd output
tar cf - \
  `find plugin/ -type f | LC_ALL=C sort` \
  `find build/pnacl* -name '*.pexe' -o -name '*.dbg.nexe' | LC_ALL=C sort` \
  | xz -T0 -9 >"${tarname}.xz"
