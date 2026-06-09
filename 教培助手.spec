# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec — 教培助手 v3.1 打包配置
构建命令: pyinstaller --clean 教培助手.spec
"""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata

block_cipher = None

# 收集前端静态文件
added_files = [
    ('index.html', '.'),
    ('css', 'css'),
    ('js', 'js'),
]

# 收集 server 包的所有子模块
hidden_imports = [
    'flask',
    'flask_sqlalchemy',
    'flask_cors',
    'waitress',
    'requests',
    'urllib3',
    'charset_normalizer',
    'idna',
    'certifi',
    'jinja2',
    'markupsafe',
    'blinker',
    'click',
    'itsdangerous',
    'werkzeug',
    'sqlalchemy',
    'json',
]

# 收集 server 子模块
hidden_imports += collect_submodules('server')

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'unittest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='教培助手_v3.1',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
