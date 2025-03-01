import asyncio
from openai import OpenAI
import types

# 配置OpenAI客户端
client = OpenAI(
    api_key="user-api-key",
    base_url="http://localhost:8003/v1"
)
# client = OpenAI(
#     api_key="REMOVED",
#     base_url="https://generativelanguage.googleapis.com/v1beta/openai"
# )
    
is_stream=True
model_name="gemini-2.0-flash-exp"

def main():
    print("发送请求...")
    response = client.chat.completions.create(
        model=model_name,
        messages=[{"role": "user", "content": "你好呀"}],
        stream=is_stream
    )
    
    if is_stream:
        full_content = ""
        print("\n开始接收流式响应:")
        try:
            for i, chunk in enumerate(response):
                print(f"\n=== 块 #{i+1} ===")
                print(f"Raw chunk: {chunk}")
                
                # 提取内容
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_content += content
                    print(f"Content: {content}")
                
                # 检查完成原因
                if chunk.choices and chunk.choices[0].finish_reason:
                    print(f"Finish reason: {chunk.choices[0].finish_reason}")
                
            print("\n=== 完整响应 ===")
            print(full_content)
        except Exception as e:
            print(f"处理流式响应时出错: {e}")
    else:
        print("\n=== 非流式响应 ===")
        print(response)

if __name__ == "__main__":
    main()