# 这是一个计算平方的函数
def square(x):
    return x * x

# 用来连接数据库的函数
def connect_database():
    print("连接数据库中...")

# 主程序入口
if __name__ == "__main__":
    # 测试函数调用
    result = square(5)
    print(f"结果: {result}")
