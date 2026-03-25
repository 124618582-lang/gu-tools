#!/bin/bash
# 请在终端中运行此脚本完成发布

echo "=========================================="
echo "GPS 可视化工具 - GitHub 发布"
echo "=========================================="
echo ""

# 检查是否已登录
if ! gh auth status &>/dev/null; then
    echo "请先登录 GitHub:"
    echo "  gh auth login"
    echo ""
    echo "按提示完成登录后，重新运行此脚本"
    exit 1
fi

echo "✓ 已登录 GitHub"
echo ""

cd /Users/gukanjian/.openclaw/workspace/gps-visualizer-electron

# 创建仓库
echo "创建 GitHub 仓库..."
gh repo create gu-tools --public --source=. --push

# 创建 Release
echo ""
echo "创建 Release..."
gh release create v1.0.0 \
    --title "GPS 可视化工具 v1.0.0" \
    --notes "初始版本

- GPS 轨迹可视化
- 支持 SQLite DB 和 CSV
- 自动识别经纬度字段
- 检查更新功能" \
    "~/Desktop/GPS 可视化工具-1.0.0-arm64.dmg" \
    "dist/GPS 可视化工具 Setup 1.0.0.exe"

echo ""
echo "=========================================="
echo "✓ 发布完成！"
echo "=========================================="
echo ""
echo "访问: https://github.com/gukanjian/gu-tools/releases"
echo ""