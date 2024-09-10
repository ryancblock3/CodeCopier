#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const glob_1 = __importDefault(require("glob"));
const readline_1 = __importDefault(require("readline"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const zlib_1 = __importDefault(require("zlib"));
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout
});
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to the configuration file'
})
    .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file name',
    default: 'codecopier_output.md'
})
    .option('compress', {
    alias: 'z',
    type: 'boolean',
    description: 'Compress the output file',
    default: false
})
    .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    default: false
})
    .help()
    .parse();
async function getConfiguration(rootPath) {
    console.log(chalk_1.default.blue('Getting configuration...'));
    const configPath = argv.config ? path_1.default.resolve(argv.config) : path_1.default.join(rootPath, '.codecopierrc.json');
    const defaultConfig = {
        exclude: ['node_modules/**', '.git/**'],
        include: ['**/*.{js,ts,py,java,c,cpp,h,hpp,css,html}']
    };
    if (fs_1.default.existsSync(configPath)) {
        console.log(chalk_1.default.green(`Configuration file found at: ${configPath}`));
        const configContent = fs_1.default.readFileSync(configPath, 'utf8');
        return { ...defaultConfig, ...JSON.parse(configContent) };
    }
    console.log(chalk_1.default.yellow('Using default configuration'));
    return defaultConfig;
}
function getAllFiles(dir, config) {
    const spinner = (0, ora_1.default)('Getting all files...').start();
    return new Promise((resolve, reject) => {
        (0, glob_1.default)(config.include.join('|'), {
            cwd: dir,
            ignore: config.exclude,
            nodir: true
        }, (err, files) => {
            if (err) {
                spinner.fail(chalk_1.default.red('Error in getAllFiles:'));
                console.error(err);
                reject(err);
            }
            else {
                spinner.succeed(chalk_1.default.green(`Found ${files.length} files`));
                if (files.length > 0 && argv.verbose) {
                    console.log(chalk_1.default.cyan('First few files found:'));
                    files.slice(0, 5).forEach(file => console.log(chalk_1.default.gray(`- ${file}`)));
                    if (files.length > 5) {
                        console.log(chalk_1.default.cyan(`... and ${files.length - 5} more`));
                    }
                }
                resolve(files);
            }
        });
    });
}
async function selectFiles(files) {
    console.log(chalk_1.default.blue('Select files to include:'));
    const selectedFiles = [];
    let index = 0;
    const askForFile = () => {
        if (index >= files.length) {
            return Promise.resolve();
        }
        const file = files[index];
        return new Promise((resolve) => {
            rl.question(chalk_1.default.yellow(`Include ${file}? (y/n/q) `), (answer) => {
                if (answer.toLowerCase() === 'y') {
                    selectedFiles.push(file);
                }
                else if (answer.toLowerCase() === 'q') {
                    return resolve();
                }
                index++;
                resolve(askForFile());
            });
        });
    };
    await askForFile();
    return selectedFiles;
}
function collectCode(rootPath, filesToInclude) {
    console.log(chalk_1.default.blue('Collecting code...'));
    let output = '# CodeCopier Output\n\n';
    const spinner = (0, ora_1.default)('Processing files').start();
    filesToInclude.forEach((file, index) => {
        spinner.text = `Processing file ${index + 1}/${filesToInclude.length}: ${file}`;
        const fullPath = path_1.default.join(rootPath, file);
        output += `## File: ${file}\n\n`;
        output += '```' + getFileExtension(file) + '\n';
        output += fs_1.default.readFileSync(fullPath, 'utf8');
        output += '\n```\n\n';
    });
    spinner.succeed(chalk_1.default.green('All files processed'));
    return output;
}
function getFileExtension(file) {
    const ext = path_1.default.extname(file).slice(1);
    const languageMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'cpp',
        'hpp': 'cpp',
        'css': 'css',
        'html': 'html'
    };
    return languageMap[ext] || '';
}
function compressOutput(content) {
    return new Promise((resolve, reject) => {
        zlib_1.default.gzip(content, (error, result) => {
            if (error)
                reject(error);
            else
                resolve(result);
        });
    });
}
async function writeOutput(content, outputPath, compress) {
    if (compress) {
        const compressedContent = await compressOutput(content);
        fs_1.default.writeFileSync(outputPath + '.gz', compressedContent);
        console.log(chalk_1.default.green(`Compressed code collected in ${outputPath}.gz`));
    }
    else {
        fs_1.default.writeFileSync(outputPath, content);
        console.log(chalk_1.default.green(`Code collected in ${outputPath}`));
    }
}
async function main() {
    console.log(chalk_1.default.blue('CodeCopier is starting...'));
    try {
        const rootPath = process.cwd();
        console.log(chalk_1.default.blue(`Working in directory: ${rootPath}`));
        const config = await getConfiguration(rootPath);
        console.log(chalk_1.default.cyan('Configuration loaded. Searching for files...'));
        const allFiles = await getAllFiles(rootPath, config);
        if (allFiles.length === 0) {
            console.log(chalk_1.default.yellow('No files found matching the criteria.'));
            console.log(chalk_1.default.cyan('Check your configuration and make sure you\'re in the correct directory.'));
            return;
        }
        console.log(chalk_1.default.green(`Found ${allFiles.length} files. Starting selection process...`));
        const selectedFiles = await selectFiles(allFiles);
        if (selectedFiles.length === 0) {
            console.log(chalk_1.default.yellow('No files selected. Exiting...'));
            return;
        }
        console.log(chalk_1.default.green(`${selectedFiles.length} files selected. Collecting code...`));
        const output = collectCode(rootPath, selectedFiles);
        const outputPath = path_1.default.join(rootPath, argv.output);
        await writeOutput(output, outputPath, argv.compress || false);
        console.log(chalk_1.default.green('CodeCopier completed successfully!'));
    }
    catch (error) {
        console.error(chalk_1.default.red('An error occurred:'));
        if (error instanceof Error) {
            console.error(chalk_1.default.red(error.message));
            console.error(chalk_1.default.gray(error.stack));
        }
        else {
            console.error(chalk_1.default.red(String(error)));
        }
    }
    finally {
        rl.close();
    }
}
main().catch(error => {
    console.error(chalk_1.default.red('Unhandled error:'));
    if (error instanceof Error) {
        console.error(chalk_1.default.red(error.message));
        console.error(chalk_1.default.gray(error.stack));
    }
    else {
        console.error(chalk_1.default.red(String(error)));
    }
    process.exit(1);
});
