// 这是一个测试JavaScript文件
// 用于测试"我爱撒谎"插件的功能

function calculateSum(a, b) {
    // 计算两个数的和
    return a + b;
}

function multiply(x, y) {
    /* 
     * 这个函数用来计算两个数的乘积
     * 参数: x, y - 两个数字
     * 返回值: 乘积结果
     */
    return x * y;
}

class Calculator {
    constructor() {
        // 初始化计算器
        this.result = 0;
    }

    add(num) {
        // 添加数字到结果中
        this.result += num;
        return this;
    }

    subtract(num) {
        // 从结果中减去数字
        this.result -= num;
        return this;
    }

    getResult() {
        // 获取当前计算结果
        return this.result;
    }
}

// 导出模块
module.exports = {
    calculateSum,
    multiply,
    Calculator
};
