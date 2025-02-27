from openai import OpenAI

# 创建客户端实例
client = OpenAI(
    api_key="user-api-key",  # 替换为settings.json中配置的user_api.api_key
    base_url="http://localhost:8003/v1"  # 替换为你的用户API地址
)

def test_chat_completion():
    try:
        # 创建一个简单的对话请求
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # 模型名称可以是任意值，因为请求会被转发
            messages=[
                {"role": "system", "content": "你是一个乐于助人的助手。"},
                {"role": "user", "content": "你好，请介绍一下你自己。"}
            ]
        )
        
        # 由于用户API设计为异步响应（返回202状态码），
        # 这里主要用于验证请求是否成功发送
        print("请求已发送！")
        
    except Exception as e:
        print(f"发生错误: {e}")

if __name__ == "__main__":
    test_chat_completion()