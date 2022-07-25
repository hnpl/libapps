#!/usr/bin/env python3
# Copyright 2020 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common util code."""

from pathlib import Path
import sys


BIN_DIR = Path(__file__).resolve().parent
DIR = BIN_DIR.parent
LIBAPPS_DIR = DIR.parent


sys.path.insert(0, str(LIBAPPS_DIR / "libdot" / "bin"))

# pylint: disable=unused-import
import libdot  # pylint: disable=wrong-import-position
