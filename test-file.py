# 这是一个测试Python文件
# 用于测试"我爱撒谎"插件的功能

def calculate_sum(a, b):
    # 计算两个数的和
    return a + b

def multiply(x, y):
    """
    这个函数用来计算两个数的乘积
    参数: x, y - 两个数字
    返回值: 乘积结果
    """
    return x * y

class Calculator:
    def __init__(self):
        # 初始化计算器
        self.result = 0
    
    def add(self, num):
        # 添加数字到结果中
        self.result += num
        return self
    
    def subtract(self, num):
        # 从结果中减去数字
        self.result -= num
        return self
    
    def get_result(self):
        # 获取当前计算结果
        return self.result

if __name__ == "__main__":
    # 主程序入口
    calc = Calculator()
    result = calc.add(10).subtract(5).get_result()
    print(f"计算结果: {result}")
