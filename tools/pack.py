# 打包静态站点到 dist/，并校验 data/ 下所有 JSON 可解析
# 用法: python tools/pack.py
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
INCLUDE = ["index.html", "app.css", "manifest.webmanifest", "sw.js", "assets", "js", "data"]


def main():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    for name in INCLUDE:
        src = os.path.join(ROOT, name)
        dst = os.path.join(DIST, name)
        if not os.path.exists(src):
            sys.exit("缺少文件：" + name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    count = 0
    for base, _dirs, files in os.walk(os.path.join(DIST, "data")):
        for f in files:
            if not f.endswith(".json"):
                continue
            path = os.path.join(base, f)
            try:
                with open(path, encoding="utf-8") as fp:
                    json.load(fp)
            except Exception as exc:
                sys.exit("JSON 校验失败：" + os.path.relpath(path, DIST) + " -> " + str(exc))
            count += 1

    print("打包完成：dist/，校验 JSON " + str(count) + " 个")


if __name__ == "__main__":
    main()
