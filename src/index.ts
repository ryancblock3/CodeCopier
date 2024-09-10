#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import readline from 'readline';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import ora from 'ora';
import zlib from 'zlib';
import micromatch from 'micromatch';

interface CodeCopierConfig {
    exclude: string[];
    include: string[];
}

interface ArgvOptions {
    config?: string;
    output: string;
    compress?: boolean;
    verbose?: boolean;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const argv = yargs(hideBin(process.argv))
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
    .parse() as ArgvOptions;

function validateConfig(config: CodeCopierConfig): void {
    if (!Array.isArray(config.exclude) || !Array.isArray(config.include)) {
        throw new Error('Configuration error: "exclude" and "include" must be arrays');
    }
    
    if (config.exclude.some(pattern => typeof pattern !== 'string') || 
        config.include.some(pattern => typeof pattern !== 'string')) {
        throw new Error('Configuration error: All patterns must be strings');
    }
}

async function getConfiguration(rootPath: string): Promise<CodeCopierConfig> {
    console.log(chalk.blue('Getting configuration...'));
    const configPath = argv.config ? path.resolve(argv.config) : path.join(rootPath, '.codecopierrc.json');
    const defaultConfig: CodeCopierConfig = {
        exclude: ['node_modules/**', '.git/**'],
        include: ['**/*.{js,ts,py,java,c,cpp,h,hpp,css,html}']
    };

    if (fs.existsSync(configPath)) {
        console.log(chalk.green(`Configuration file found at: ${configPath}`));
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const parsedConfig = JSON.parse(configContent);
            const mergedConfig = { ...defaultConfig, ...parsedConfig };
            validateConfig(mergedConfig);
            return mergedConfig;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error reading or parsing configuration file: ${error.message}`);
            } else {
                throw new Error('An unknown error occurred while reading the configuration file');
            }
        }
    }

    console.log(chalk.yellow('Using default configuration'));
    return defaultConfig;
}

function getAllFiles(dir: string, config: CodeCopierConfig): Promise<string[]> {
    const spinner = ora('Getting all files...').start();
    return new Promise((resolve, reject) => {
        glob(config.include.join('|'), {
            cwd: dir,
            ignore: config.exclude,
            nodir: true
        }, (err: Error | null, files: string[]) => {
            if (err) {
                spinner.fail(chalk.red('Error in getAllFiles:'));
                if (err.message.includes('ENOENT')) {
                    reject(new Error(`Directory not found: ${dir}`));
                } else if (err.message.includes('EACCES')) {
                    reject(new Error(`Permission denied: Cannot access ${dir}`));
                } else {
                    reject(new Error(`Error reading directory: ${err.message}`));
                }
            } else {
                spinner.succeed(chalk.green(`Found ${files.length} files`));
                if (files.length > 0 && argv.verbose) {
                    console.log(chalk.cyan('First few files found:'));
                    files.slice(0, 5).forEach(file => console.log(chalk.gray(`- ${file}`)));
                    if (files.length > 5) {
                        console.log(chalk.cyan(`... and ${files.length - 5} more`));
                    }
                }
                resolve(files);
            }
        });
    });
}

function createProgressBar(total: number): (current: number) => void {
    const barLength = 30;
    return (current: number) => {
        const filled = Math.round(barLength * current / total);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        const percentage = Math.round(100 * current / total);
        process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total})`);
    };
}

async function selectFiles(files: string[]): Promise<string[]> {
    console.log(chalk.blue('Select files to include:'));
    const selectedFiles: string[] = [];
    let index = 0;
    const updateProgress = createProgressBar(files.length);

    const askForFile = async (): Promise<void> => {
        if (index >= files.length) {
            process.stdout.write('\n'); // Move to the next line after progress bar
            return;
        }

        updateProgress(index + 1);
        const file = files[index];
        const answer = await new Promise<string>((resolve) => {
            rl.question(chalk.yellow(`\nInclude ${file}? (y/n/p/q) `), resolve);
        });

        switch (answer.toLowerCase()) {
            case 'y':
                selectedFiles.push(file);
                index++;
                break;
            case 'n':
                index++;
                break;
            case 'p':
                const pattern = await new Promise<string>((resolve) => {
                    rl.question(chalk.cyan('Enter glob pattern: '), resolve);
                });
                const matchedFiles = micromatch(files.slice(index), pattern);
                selectedFiles.push(...matchedFiles);
                index += matchedFiles.length;
                console.log(chalk.green(`Added ${matchedFiles.length} files matching the pattern.`));
                break;
            case 'q':
                process.stdout.write('\n');
                return;
            default:
                console.log(chalk.red('Invalid input. Please enter y, n, p, or q.'));
        }

        await askForFile();
    };

    await askForFile();
    return selectedFiles;
}

function collectCode(rootPath: string, filesToInclude: string[]): string {
    console.log(chalk.blue('Collecting code...'));
    let output = '# CodeCopier Output\n\n';
    const spinner = ora('Processing files').start();
    filesToInclude.forEach((file, index) => {
        spinner.text = `Processing file ${index + 1}/${filesToInclude.length}: ${file}`;
        const fullPath = path.join(rootPath, file);
        output += `## File: ${file}\n\n`;
        output += '```' + getFileExtension(file) + '\n';
        output += fs.readFileSync(fullPath, 'utf8');
        output += '\n```\n\n';
    });
    spinner.succeed(chalk.green('All files processed'));
    return output;
}

function getFileExtension(file: string): string {
    const ext = path.extname(file).slice(1);
    const languageMap: { [key: string]: string } = {
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

function compressOutput(content: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        zlib.gzip(content, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
}

async function writeOutput(content: string, outputPath: string, compress: boolean) {
    if (compress) {
        const compressedContent = await compressOutput(content);
        fs.writeFileSync(outputPath + '.gz', compressedContent);
        console.log(chalk.green(`Compressed code collected in ${outputPath}.gz`));
    } else {
        fs.writeFileSync(outputPath, content);
        console.log(chalk.green(`Code collected in ${outputPath}`));
    }
}

async function main() {
    console.log(chalk.blue('CodeCopier is starting...'));
    try {
        const rootPath = process.cwd();
        console.log(chalk.blue(`Working in directory: ${rootPath}`));

        const config = await getConfiguration(rootPath);
        console.log(chalk.cyan('Configuration loaded. Searching for files...'));

        const allFiles = await getAllFiles(rootPath, config);
        
        if (allFiles.length === 0) {
            console.log(chalk.yellow('No files found matching the criteria.'));
            console.log(chalk.cyan('Check your configuration and make sure you\'re in the correct directory.'));
            return;
        }

        console.log(chalk.green(`Found ${allFiles.length} files. Starting selection process...`));

        const selectedFiles = await selectFiles(allFiles);

        if (selectedFiles.length === 0) {
            console.log(chalk.yellow('No files selected. Exiting...'));
            return;
        }

        console.log(chalk.green(`${selectedFiles.length} files selected. Collecting code...`));

        const output = collectCode(rootPath, selectedFiles);
        const outputPath = path.join(rootPath, argv.output);
        await writeOutput(output, outputPath, argv.compress || false);

        console.log(chalk.green('CodeCopier completed successfully!'));
    } catch (error) {
        console.error(chalk.red('An error occurred:'));
        if (error instanceof Error) {
            console.error(chalk.red(error.message));
            if (argv.verbose) {
                console.error(chalk.gray(error.stack));
            }
        } else {
            console.error(chalk.red(String(error)));
        }
    } finally {
        rl.close();
    }
}

main().catch(error => {
    console.error(chalk.red('Unhandled error:'));
    if (error instanceof Error) {
        console.error(chalk.red(error.message));
        if (argv.verbose) {
            console.error(chalk.gray(error.stack));
        }
    } else {
        console.error(chalk.red(String(error)));
    }
    process.exit(1);
});