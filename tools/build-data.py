# 从 cn-math-taxonomy 开源数据生成按学科拆分的数据文件（仅用于本地应用）
# 用法: python tools/build-data.py <源仓库路径>
import json, os, sys, collections

SRC = sys.argv[1] if len(sys.argv) > 1 else r"D:\UsersData\.cache\pansgo\cn-math-taxonomy"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

SUBJECTS = {
    "math": {"prefix": "cnm_", "label": "数学"},
    "chinese": {"prefix": "cnc_", "label": "语文"},
    "english": {"prefix": "cne_", "label": "英语"},
    "physics": {"prefix": "cnp_", "label": "物理"},
}

GRADE_LABELS = {
    "math": {1: "一年级", 2: "二年级", 3: "三年级", 4: "四年级", 5: "五年级", 6: "六年级",
             7: "七年级", 8: "八年级", 9: "九年级",
             10: "高一（必修第一册）", 11: "高二（必修第二册）",
             12: "选必一（选择性必修第一册）", 13: "选必二（选择性必修第二册）", 14: "选必三（选择性必修第三册）"},
    "chinese": {1: "一年级", 2: "二年级", 3: "三年级", 4: "四年级", 5: "五年级", 6: "六年级"},
    "english": {3: "三年级", 4: "四年级", 5: "五年级", 6: "六年级", 7: "七年级", 8: "八年级", 9: "九年级",
                10: "必修一（必修第一册）", 11: "必修二（必修第二册）", 12: "必修三（必修第三册）",
                13: "选必一（选择性必修第一册）", 14: "选必二（选择性必修第二册）",
                15: "选必三（选择性必修第三册）", 16: "选必四（选择性必修第四册）"},
    "physics": {8: "八年级", 9: "九年级", 10: "必修一", 11: "必修二", 12: "必修三",
                13: "选必一", 14: "选必二", 15: "选必三"},
}

STAGE = {
    "math": lambda g: "小学" if g <= 6 else ("初中" if g <= 9 else "高中"),
    "chinese": lambda g: "小学" if g <= 6 else "初中",
    "english": lambda g: "小学" if g <= 6 else ("初中" if g <= 9 else "高中"),
    "physics": lambda g: "初中" if g <= 9 else "高中",
}


def load(name):
    with open(os.path.join(SRC, "data", name), encoding="utf-8") as f:
        return json.load(f)


def main():
    topics = load("topics.json")
    deps = load("dependencies.json")
    questions = load("questions.json")
    os.makedirs(OUT, exist_ok=True)

    ids_by_subject = {}
    for key, cfg in SUBJECTS.items():
        ids_by_subject[key] = {t["id"] for t in topics if t["id"].startswith(cfg["prefix"])}

    meta = {"generated": "", "subjects": {}}
    import datetime
    meta["generated"] = datetime.date.today().isoformat()

    for key, cfg in SUBJECTS.items():
        ids = ids_by_subject[key]
        sub_topics = [t for t in topics if t["id"] in ids]
        sub_deps = [d for d in deps if d["topicId"] in ids and d["prerequisiteId"] in ids]
        sub_questions = [q for q in questions if q["topicId"] in ids]

        folder = os.path.join(OUT, key)
        os.makedirs(folder, exist_ok=True)
        for name, payload in (("topics.json", sub_topics), ("dependencies.json", sub_deps), ("questions.json", sub_questions)):
            with open(os.path.join(folder, name), "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

        q_by_topic = collections.Counter(q["topicId"] for q in sub_questions)
        no_question = sum(1 for t in sub_topics if q_by_topic[t["id"]] == 0)
        standards = set()
        for t in sub_topics:
            for s in t.get("standards") or []:
                if s.get("id"):
                    standards.add(s["id"])

        grades = []
        for g in sorted({t["grade"] for t in sub_topics if isinstance(t.get("grade"), int)}):
            count = sum(1 for t in sub_topics if t.get("grade") == g)
            nq = sum(q_by_topic[t["id"]] for t in sub_topics if t.get("grade") == g)
            grades.append({
                "grade": g,
                "label": GRADE_LABELS[key].get(g, f"{g}年级"),
                "stage": STAGE[key](g),
                "topics": count,
                "questions": nq,
            })

        domains = collections.Counter(t.get("domain") or "其他" for t in sub_topics)
        meta["subjects"][key] = {
            "label": cfg["label"],
            "topics": len(sub_topics),
            "edges": len(sub_deps),
            "questions": len(sub_questions),
            "standards": len(standards),
            "topicsWithoutQuestion": no_question,
            "grades": grades,
            "domains": [{"name": k, "count": v} for k, v in domains.most_common()],
        }
        print(f"{key}: {len(sub_topics)} topics, {len(sub_deps)} edges, {len(sub_questions)} questions, "
              f"{len(standards)} standards, {no_question} topics without questions")

    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
