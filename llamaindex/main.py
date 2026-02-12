"""LlamaIndex BGE-M3 检索与录入 - 统一入口"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description="LlamaIndex BGE-M3：MySQL 导入、向量检索、OCR 匹配")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # ingest
    ingest_parser = subparsers.add_parser("ingest", help="从 MySQL 导入并录入 Milvus")
    ingest_parser.add_argument("--overwrite", action="store_true", help="清空重建 collection")

    # query
    query_parser = subparsers.add_parser("query", help="检索（Hybrid + RRF）")
    query_parser.add_argument("question", nargs="?", help="查询问题（省略则交互式输入）")
    query_parser.add_argument("-k", "--top-k", type=int, default=5, help="返回 top-k 结果")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "ingest":
        from src.ingest import run_ingest
        run_ingest(overwrite=args.overwrite)

    elif args.command == "query":
        from src.query import query
        q = args.question
        if q:
            query(q, top_k=args.top_k)
        else:
            print("输入查询（回车发送，空行退出）:")
            while True:
                line = input("> ").strip()
                if not line:
                    break
                query(line, top_k=args.top_k)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
