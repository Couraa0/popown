from langchain_ollama import ChatOllama
from config import OLLAMA_BASE_URL, OLLAMA_API_KEY, OLLAMA_MODEL


def get_llm():
    client_kwargs = {
        "timeout": 120,
    }
    if OLLAMA_API_KEY:
        client_kwargs["headers"] = {
            "Authorization": f"Bearer {OLLAMA_API_KEY}"
        }
    return ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=0.3,
        num_predict=4096,
        client_kwargs=client_kwargs,
    )


def invoke_llm(prompt: str) -> str:
    llm = get_llm()
    response = llm.invoke(prompt)
    return response.content
