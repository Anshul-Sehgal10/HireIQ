from app import main
from app.core.config import settings
import uvicorn

if __name__ == "__main__":
    uvicorn.run(main.app, host=settings.HOST, port=settings.PORT)
