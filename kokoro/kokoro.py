#!/usr/bin/env python3
# Copyright 2019 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common kokoro util code."""

from pathlib import Path
import sys


DIR = Path(__file__).resolve().parent
LIBAPPS_DIR = DIR.parent


sys.path.insert(0, str(LIBAPPS_DIR / "libdot" / "bin"))

# pylint: disable=unused-import
import libdot  # pylint: disable=wrong-import-position
