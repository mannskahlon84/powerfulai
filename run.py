import argparse
import uvicorn

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run HR AI Assistant Microservice")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind")
    parser.add_argument("--port", type=int, default=8088, help="Port to bind (default: 8088)")
    parser.add_argument("--reload", action="store_true", default=True, help="Enable auto-reload")

    args = parser.parse_args()
    print(f"============================================================")
    print(f" [*] Starting HR AI Assistant Microservice on port {args.port}")
    print(f" [*] Web Dashboard : http://{args.host}:{args.port}/")
    print(f" [*] OpenAPI Docs  : http://{args.host}:{args.port}/docs")
    print(f"============================================================")

    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)
