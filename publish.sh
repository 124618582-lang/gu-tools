#!/bin/bash
# GPS 可视化工具 - GitHub 发布脚本
# 请将 YOUR_USERNAME 替换为你的 GitHub 用户名

echo "=========================================="
echo "GPS 可视化工具 - GitHub 发布脚本"
echo "=========================================="
echo ""

# 配置
USERNAME="gukanjian"  # GitHub 用户名
REPO_NAME="gu-tools"   # 仓库名：顾侃健工具箱
VERSION="1.0.0"

echo "步骤 1: 配置 Git 用户信息"
echo "------------------------------------------"
echo "请确保已配置 Git 用户名和邮箱:"
echo "  git config --global user.name \"你的名字\""
echo "  git config --global user.email \"你的邮箱@example.com\""
echo ""

echo "步骤 2: 添加文件到 Git"
echo "------------------------------------------"
git add .

echo "步骤 3: 提交更改"
echo "------------------------------------------"
git commit -m "v${VERSION} - GPS 可视化工具初始版本"

echo "步骤 4: 重命名分支为 main"
echo "------------------------------------------"
git branch -m main

echo "步骤 5: 添加远程仓库"
echo "------------------------------------------"
echo "运行: git remote add origin https://github.com/${USERNAME}/${REPO_NAME}.git"
git remote add origin "https://github.com/${USERNAME}/${REPO_NAME}.git" 2>/dev/null || echo "远程仓库已存在"

echo "步骤 6: 推送到 GitHub"
echo "------------------------------------------"
echo "运行: git push -u origin main"
echo ""
echo "如果提示输入用户名密码，请输入你的 GitHub 用户名和个人访问令牌(PAT)"
echo ""

echo "=========================================="
echo "发布完成后，请执行以下操作:"
echo "=========================================="
echo ""
echo "1. 访问 https://github.com/${USERNAME}/${REPO_NAME}"
echo "2. 点击 'Releases' -> 'Create a new release'"
echo "3. 标签: v${VERSION}"
echo "4. 标题: v${VERSION}"
echo "5. 上传以下文件:"
echo "   - dist/GPS 可视化工具-${VERSION}-arm64.dmg"
echo "   - dist/GPS 可视化工具 Setup ${VERSION}.exe"
echo "6. 点击 'Publish release'"
echo ""
echo "7. 修改 version.json 中的下载链接为实际的 Release 链接"
echo "8. 提交并推送 version.json 更改"
echo ""
echo "=========================================="