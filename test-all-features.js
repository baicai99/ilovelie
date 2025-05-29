// 测试文件 - 用于验证"我爱撒谎"插件的所有功能
// 请按照以下步骤测试插件功能：

// 步骤1：测试选中替换功能
// 选中下面这行注释，右键选择"替换选中的注释"
// 这是一个用来计算面积的函数
function calculateArea(width, height) {
    return width * height;
}

// 步骤2：测试手动替换功能
// 使用Ctrl+Shift+P，输入"手动替换注释"
// 这个函数用来发送邮件
function sendEmail(to, subject, body) {
    console.log(`发送邮件到 ${to}`);
}

// 步骤3：测试还原功能
// 右键菜单应该包含以下选项：
// - 撤销上次撒谎
// - 查看撒谎历史  
// - 从历史中还原

/* 
 * 这是一个多行注释
 * 用来处理用户登录
 */
function userLogin(username, password) {
    return authenticate(username, password);
}

// 步骤4：测试Python注释（如果需要）
// 可以创建一个.py文件来测试Python注释格式

// 测试完成后，您应该能够：
// 1. 成功替换任何注释
// 2. 查看替换历史
// 3. 撤销或还原任何替换操作
// 4. 在右键菜单中看到所有功能
