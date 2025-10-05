#!/bin/bash

# AI图片编辑工具生产环境部署脚本
# 使用方法: ./scripts/deploy.sh [环境名称]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
ENVIRONMENT=${1:-production}
log_info "开始部署到 $ENVIRONMENT 环境..."

# 检查必要的环境变量
check_env_vars() {
    local required_vars=(
        "GEMINI_API_KEY"
        "SESSION_SECRET"
        "ALLOWED_ORIGINS"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "环境变量 $var 未设置"
            exit 1
        fi
    done
    
    log_info "环境变量检查通过"
}

# 检查系统依赖
check_dependencies() {
    local deps=("node" "npm" "nginx")
    
    for dep in "${deps[@]}"; do
        if ! command -v $dep &> /dev/null; then
            log_error "$dep 未安装"
            exit 1
        fi
    done
    
    log_info "系统依赖检查通过"
}

# 创建必要目录
create_directories() {
    local dirs=(
        "/var/www/ai-image-editor"
        "/var/www/uploads"
        "/tmp/ai-editor"
        "/var/log/ai-editor"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            log_info "创建目录: $dir"
            sudo mkdir -p "$dir"
        fi
    done
    
    # 设置目录权限
    sudo chown -R www-data:www-data /var/www/uploads
    sudo chown -R www-data:www-data /tmp/ai-editor
    sudo chown -R www-data:www-data /var/log/ai-editor
    sudo chmod 755 /var/www/uploads
    sudo chmod 755 /tmp/ai-editor
    sudo chmod 755 /var/log/ai-editor
    
    log_info "目录创建和权限设置完成"
}

# 备份当前版本
backup_current() {
    if [ -d "/var/www/ai-image-editor" ]; then
        local backup_dir="/var/backups/ai-image-editor-$(date +%Y%m%d-%H%M%S)"
        log_info "备份当前版本到: $backup_dir"
        sudo cp -r /var/www/ai-image-editor "$backup_dir"
    fi
}

# 部署应用
deploy_app() {
    log_info "部署应用文件..."
    
    # 复制应用文件
    sudo cp -r . /var/www/ai-image-editor/
    cd /var/www/ai-image-editor
    
    # 设置正确的所有者
    sudo chown -R www-data:www-data /var/www/ai-image-editor
    
    # 安装依赖
    log_info "安装生产依赖..."
    sudo -u www-data npm ci --only=production
    
    # 构建应用
    log_info "构建应用..."
    sudo -u www-data npm run build
    
    log_info "应用部署完成"
}

# 配置PM2
setup_pm2() {
    log_info "配置PM2..."
    
    # 检查PM2是否已安装
    if ! command -v pm2 &> /dev/null; then
        log_info "安装PM2..."
        sudo npm install -g pm2
    fi
    
    # 停止现有进程
    pm2 delete ai-image-editor 2>/dev/null || true
    
    # 启动新进程
    cd /var/www/ai-image-editor
    pm2 start ecosystem.config.js --env $ENVIRONMENT
    
    # 保存PM2配置
    pm2 save
    
    # 设置开机自启
    sudo pm2 startup systemd -u www-data --hp /var/www
    
    log_info "PM2配置完成"
}

# 配置Nginx
setup_nginx() {
    log_info "配置Nginx..."
    
    # 复制Nginx配置
    sudo cp deployment/nginx.conf /etc/nginx/sites-available/ai-image-editor
    
    # 启用站点
    sudo ln -sf /etc/nginx/sites-available/ai-image-editor /etc/nginx/sites-enabled/
    
    # 测试配置
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        # 重新加载Nginx
        sudo systemctl reload nginx
        log_info "Nginx配置完成"
    else
        log_error "Nginx配置测试失败"
        exit 1
    fi
}

# 设置定时任务
setup_cron() {
    log_info "设置定时任务..."
    
    # 文件清理任务
    (crontab -l 2>/dev/null | grep -v "ai-editor"; echo "0 */6 * * * find /tmp/ai-editor -type f -mtime +1 -delete") | crontab -
    
    # 日志轮转任务
    (crontab -l 2>/dev/null | grep -v "ai-editor-logs"; echo "0 0 * * * find /var/log/ai-editor -name '*.log' -mtime +7 -delete") | crontab -
    
    log_info "定时任务设置完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:4321/health > /dev/null 2>&1; then
            log_info "健康检查通过"
            return 0
        fi
        
        log_warn "健康检查失败，重试 $attempt/$max_attempts"
        sleep 2
        ((attempt++))
    done
    
    log_error "健康检查失败，部署可能有问题"
    return 1
}

# 部署后清理
cleanup() {
    log_info "执行部署后清理..."
    
    # 清理旧的备份（保留最近5个）
    sudo find /var/backups -name "ai-image-editor-*" -type d | sort -r | tail -n +6 | xargs -r sudo rm -rf
    
    # 清理npm缓存
    npm cache clean --force
    
    log_info "清理完成"
}

# 主部署流程
main() {
    log_info "=== AI图片编辑工具部署开始 ==="
    
    check_env_vars
    check_dependencies
    backup_current
    create_directories
    deploy_app
    setup_pm2
    setup_nginx
    setup_cron
    
    if health_check; then
        cleanup
        log_info "=== 部署成功完成 ==="
        log_info "应用访问地址: https://$(hostname -f)"
        log_info "健康检查地址: https://$(hostname -f)/health"
        log_info "PM2状态: pm2 status"
        log_info "应用日志: pm2 logs ai-image-editor"
    else
        log_error "=== 部署失败 ==="
        log_error "请检查应用日志: pm2 logs ai-image-editor"
        exit 1
    fi
}

# 捕获错误并清理
trap 'log_error "部署过程中发生错误，正在清理..."; exit 1' ERR

# 执行主流程
main "$@"