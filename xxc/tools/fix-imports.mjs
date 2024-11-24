import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_DIR = path.join(__dirname, '../app');

// 扩展名映射
const EXT_MAP = {
    '.js': true,
    '.jsx': true,
    '.json': true,
    '.mjs': true
};

// 递归遍历目录
function* walkSync(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            yield* walkSync(filePath);
        } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
            yield filePath;
        }
    }
}

// 检查文件是否存在（考虑不同扩展名）
function findFile(importPath) {
    // 如果已经有扩展名且文件存在，直接返回
    if (path.extname(importPath) && fs.existsSync(importPath)) {
        return importPath;
    }

    // 尝试不同的扩展名
    for (const ext of Object.keys(EXT_MAP)) {
        const fullPath = `${importPath}${ext}`;
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    // 如果是目录，查找 index 文件
    if (fs.existsSync(importPath) && fs.statSync(importPath).isDirectory()) {
        for (const ext of Object.keys(EXT_MAP)) {
            const indexPath = path.join(importPath, `index${ext}`);
            if (fs.existsSync(indexPath)) {
                return indexPath;
            }
        }
    }

    return null;
}

// 修复导入语句
function fixImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);
    let modified = false;

    // 匹配 import 语句
    const importRegex = /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]/g;
    content = content.replace(importRegex, (match, importPath) => {
        // 忽略包导入
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return match;
        }

        // 解析完整路径
        const fullPath = path.resolve(dir, importPath);
        const resolvedPath = findFile(fullPath);

        if (resolvedPath) {
            // 获取相对路径
            let relativePath = path.relative(dir, resolvedPath);
            // 确保以 ./ 或 ../ 开头
            if (!relativePath.startsWith('.')) {
                relativePath = `./${relativePath}`;
            }
            modified = true;
            return match.replace(importPath, relativePath);
        }

        return match;
    });

    // 匹配 require 语句
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    content = content.replace(requireRegex, (match, importPath) => {
        // 忽略包导入
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return match;
        }

        // 解析完整路径
        const fullPath = path.resolve(dir, importPath);
        const resolvedPath = findFile(fullPath);

        if (resolvedPath) {
            // 获取相对路径
            let relativePath = path.relative(dir, resolvedPath);
            // 确保以 ./ 或 ../ 开头
            if (!relativePath.startsWith('.')) {
                relativePath = `./${relativePath}`;
            }
            modified = true;
            return match.replace(importPath, relativePath);
        }

        return match;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed imports in ${path.relative(APP_DIR, filePath)}`);
    }
}

// 主函数
function main() {
    for (const file of walkSync(APP_DIR)) {
        try {
            fixImports(file);
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }
}

main();
