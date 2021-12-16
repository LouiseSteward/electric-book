/*jslint node */
/*globals */

// var { shelljs } = require('shelljs'); // for unix commands, not needed yet
var setup = require('./_tools/js/setup.json'); // defines the project setup we check against
var options = require('./_tools/js/options.json'); // options for argv
var argv = require('yargs').options(options).argv; // for accepting arguments when calling this script
var fs = require('fs'); // for working with the file-system
var fsPath = require('path'); // Node's path tool, e.g. for normalizing paths cross-platform
var spawn = require('cross-spawn'); // for spawning child processes like Jekyll across platforms
var open = require('open'); // opens files in user's preferred app
var prince = require('prince'); // installs and runs PrinceXML
var yaml = require('js-yaml'); // reads YAML files into JS objects


// All the functions
// -----------------

// Output spawned-process data to console
// and callback when the process exits.
function logProcess(process, processName, callback) {
    'use strict';

    processName = processName || 'Process: ';

    // Listen to stdout
    process.stdout.on('data', function (data) {
        console.log(processName + ': ' + data);
    });

    // Listen to stderr
    process.stderr.on('data', function (data) {
        console.log(processName + ': ' + data);
    });

    // Listen for an error event:
    process.on('error', function (errorCode) {
        console.log(processName + ' errored with: ' + errorCode);
        if (callback) {
            callback();
        }
    });

    // Listen for an exit event:
    process.on('exit', function (exitCode) {
        console.log(processName + ' exited with: ' + exitCode);
        if (callback) {
            callback();
        }
    });
}

// // Assembles the app files in _site/app
// function appAssemble() {
//     'use strict';
//     console.log('Assembling app...');
// }

// // Attempts to build the app with Cordova
// function appBuild() {
//     'use strict';
//     console.log('Building app HTML...');
// }

// // Attempts to open the app in an emulator
// function appEmulate() {
//     'use strict';
//     console.log('Attempting to open app emulator...');
// }

// Checks if a file or folder exists
function checkExists(path) {
    'use strict';
    console.log('Checking that ' + path + ' exists.');
    fs.access(path, function (err) {
        if (err && err.code === 'ENOENT') {
            console.log('Missing: ' + path + ' not found.');
        }
    });
}

// Checks project for critical files and folders
function checkProjectSetup(book) {
    'use strict';

    console.log('Checking project setup for ' + book);
    setup.forEach(function (item) {
        checkExists(item.path);
    });
    console.log('Check complete.');
}

// Return a string of Jekyll config files.
// The filenames passed must be of files
// already saved in the _configs directory.
// They will be added after the default _config.yml.
function configs(configFiles) {
    'use strict';

    var configString = '_config.yml';

    // Add configs passed as argv's
    if (argv.configs) {
        console.log('Adding ' + argv.configs + ' to configs...');
        // Strip quotes that might have been added around arguments by user
        configString += '_configs/' + argv.configs.replace(/'/g, '').replace(/"/g, '') + ',';
    }

    // Add any configs passed as a string to this function.
    if (configFiles) {
        // Strip spaces, then split the string into an array,
        // then loop through the array adding each config file.
        configFiles.replace(/\s/g, '');
        configFiles.split(',').forEach(function (configFile) {
            configString += ',_configs/' + configFile;
        });
    }

    // Add MathJax config if --mathjax=true
    if (argv.mathjax === true) {
        console.log('Enabling MathJax...');
        configString += ',_configs/_config.mathjax-enabled.yml';
    }

    return configString;
}

// // Assembles epub in _site/epub
// function epubAssemble() {
//     'use strict';
//     console.log('Assembling epub...');
// }

// // Copies epub files into a compressed zip package correctly
// function epubPackage() {
//     'use strict';
//     console.log('Packaging epub...');
// }

// // Attempts to run the epub through epubcheck
// function epubValidate(path) {
//     'use strict';
//     console.log('Validating epub...');
// }

// // Exit
// function exit() {
//     'use strict';
//     console.log('Exiting...');
// }

// // Converts .html files to .docx with pandoc
// function exportWord() {
//     'use strict';
//     console.log('Exporting to Word...');
// }

// Run Jekyll with options,
// and pass a callback through to logProcess,
// which calls the callback when Jekyll exits.
function jekyll(command,
        configs,
        baseurl,
        switches,
        callback) {

    'use strict';

    console.log('Running Jekyll with command: ' +
            'bundle exec jekyll ' + command +
            ' --config="' + configs + '"' +
            ' --baseurl="' + baseurl + '"' +
            ' ' + switches);

    // Credit for child_process examples:
    // https://medium.com/@graeme_boy/how-to-optimize-cpu-intensive-work-in-node-js-cdc09099ed41

    // Create a child process
    var jekyllProcess = spawn(
        'bundle',
        ['exec', 'jekyll', command,
                '--config', configs,
                '--baseurl', baseurl,
                switches]
    );
    logProcess(jekyllProcess, 'Jekyll', callback);
}

// // Processes mathjax in output HTML
var mathjaxRendered = false;
function renderMathjax(callback) {
    'use strict';
    console.log('Rendering MathJax...');

    var mathJaxProcess;
    if (argv.subdir) {
        mathJaxProcess = spawn(
            'gulp',
            ['mathjax',
                    '--book', argv.book,
                    '--language', argv.subdir]
        );
    } else {
        mathJaxProcess = spawn(
            'gulp',
            ['mathjax', '--book', argv.book]
        );
    }
    logProcess(mathJaxProcess, 'Gulp', callback);
    mathjaxRendered = true;
}

// Returns a filename
function outputFilename() {
    'use strict';

    var filename;
    var fileExtension = '.pdf';
    if (argv.format === 'epub') {
        fileExtension = '.epub';
    }

    if (argv.subdir) {
        filename = argv.book + '-' + argv.subdir + '-' + argv.format + fileExtension;
    } else {
        filename = argv.book + '-' + argv.format + fileExtension;
    }

    return filename;
}

// Opens the output file
function openOutputFile() {
    'use strict';
    var filePath = fsPath.normalize(process.cwd() + '/_output/' + outputFilename());
    console.log('Your ' + argv.format + ' is in ' + filePath);
    open(fsPath.normalize(filePath));
}

// Get project settings from settings.yml
function projectSettings() {
    'use strict';
    var settings;
    try {
        settings = yaml.load(fs.readFileSync('./_data/settings.yml', 'utf8'));
    } catch (error) {
        console.log(error);
    }
    return settings;
}

// Get the filelist for a format
function fileList(format) {
    'use strict';

    if (!format) {
        format = 'web'; // default
    }

    // Check for variant-edition output
    var variant = false;
    if (projectSettings()['active-variant']
            && projectSettings()['active-variant'] !== '') {
        variant = projectSettings()['active-variant'];
    }

    var book = "book"; // default
    if (argv.book) {
        book = argv.book;
    }

    // Build path to YAML data for this book
    var pathToYAMLFolder = process.cwd()
            + '/_data/works/'
            + book + '/';

    // Build path to default-edition YAML
    var pathToDefaultYAML = pathToYAMLFolder + 'default.yml';

    // Get the files list
    var metadata = yaml.load(fs.readFileSync(pathToDefaultYAML, 'utf8'));
    var files = metadata.products[format].files;

    // If there was no files list, oops!
    if (!files) {
        return [];
    }

    // Build path to translation's default YAML,
    // if a language has been specified.
    var pathToTranslationYAMLFolder,
        pathToDefaultTranslationYAML;
    if (argv.language) {
        pathToTranslationYAMLFolder = pathToYAMLFolder + argv.language + '/';
        pathToDefaultTranslationYAML = pathToTranslationYAMLFolder + 'default.yml';

        // If the translation has this format among its products,
        // and that format has a files list, use that list.
        if (pathToDefaultTranslationYAML
                && fs.existsSync(pathToDefaultTranslationYAML)) {
            var translationMetadata = yaml.load(fs.readFileSync(pathToDefaultTranslationYAML, 'utf8'));
            if (translationMetadata
                    && translationMetadata.products
                    && translationMetadata.products[format]
                    && translationMetadata.products[format].files) {
                files = translationMetadata.products[format].files;
            }
        }
    }

    // Build path to variant-edition YAML,
    // if there is an active variant in settings.
    var pathToVariantYAML = false;

    // If there's a variant and this is a translation ...
    if (argv.language && variant) {
        pathToVariantYAML = pathToTranslationYAMLFolder + variant + '.yml';

    // ... otherwise just get the parent language variant path
    } else if (variant) {
        pathToVariantYAML = pathToYAMLFolder + variant + '.yml';
    }

    // If we have a path, and there's a files list there,
    // use that as the files list.
    if (pathToVariantYAML
            && fs.existsSync(pathToVariantYAML)) {
        var variantMetadata = yaml.load(fs.readFileSync(pathToVariantYAML, 'utf8'));
        if (variantMetadata
                && variantMetadata.products
                && variantMetadata.products[format]
                && variantMetadata.products[format].files) {
            files = variantMetadata.products[format].files;
        }
    }

    return files;
}

// Get array of file paths for this output
function filePaths(format) {
    'use strict';

    var fileNames = fileList(format);

    var pathToFiles;
    if (argv.subdir) {
        pathToFiles = process.cwd() + '/' +
                '_site/' +
                argv.book + '/' +
                argv.subdir;
    } else {
        pathToFiles = process.cwd() + '/' +
                '_site/' +
                argv.book;
    }
    pathToFiles = fsPath.normalize(pathToFiles);

    console.log('Using files in ' + pathToFiles);

    // Prepend path to fileNames
    var filePaths = fileNames.map(function (filename) {
        return pathToFiles + '/' + filename + '.html';
    });

    return filePaths;
}

// Run Prince
function runPrince(format) {
    'use strict';

    console.log('Rendering HTML to PDF with PrinceXML...');

    if (format === undefined) {
        format = 'print-pdf';
    }

    // Get Prince license file, if any
    // (and allow for 'correct' spelling, licence).
    var princeLicenseFile = '';
    var princeLicensePath;
    var princeConfig = require("./package.json").prince;
    if (princeConfig && princeConfig.license) {
        princeLicensePath = princeConfig.license;
    } else if (princeConfig && princeConfig.licence) {
        princeLicensePath = princeConfig.licence;
    }
    if (fs.existsSync(princeLicensePath)) {
        princeLicenseFile = princeLicensePath;
        console.log('Using PrinceXML licence found at ' + princeLicenseFile);
    }

    prince()
        .license('./' + princeLicenseFile)
        .inputs(filePaths(format))
        .output(process.cwd() + '/_output/' + outputFilename(format))
        .option('javascript')
        .option('verbose')
        .timeout(100 * 1000) // required for larger books
        .execute()
        .then(function () {
            openOutputFile();
        }, function (error) {
            console.log(error);
        });
}

// Kills child processes
// function killProcesses() {
//     'use strict';
//     console.log('Killing processes...');
// }

// // Starting place when -t output -f app
// function outputApp() {
//     'use strict';
//     console.log('Creating app...');
// }

// // Starting place when -t output -f epub
// function outputEpub() {
//     'use strict';
//     console.log('Creating epub...');
// }

// Output a print PDF
function outputPDF() {
    'use strict';

    // If Mathjax is enabled, first render mathjax,
    // otherwise continue with the PDF process.
    if (mathjaxRendered === true) {
        runPrince(argv.format);
    } else {
        console.log('Mathjax enabled, rendering maths first.');
        renderMathjax(outputPDF);
    }
}

// // Serve a website
// function outputWeb() {
//     'use strict';
//     console.log('Building website...');
// }

// Return switches for Jekyll
function switches(switchesString) {
    'use strict';

    var jekyllSwitches = '';

    // Add incremental switch if --incremental=true
    if (argv.incremental === true) {
        console.log('Enabling incremental build...');
        jekyllSwitches += '--incremental ';
    }

    // Add switches passed as argv's to the switchesString
    if (argv.switches) {
        console.log('Adding ' + argv.switches + ' to switches...');
        // Strip quotes that might have been added around arguments by user
        switchesString += argv.switches.replace(/'/g, '').replace(/"/g, '');
    }

    // Add all switches in switchesString
    if (switchesString) {
        // Strip spaces, then split the string into an array,
        // then loop through the array adding each switch.
        switchesString.replace(/\s/g, '');
        switchesString.split(',');
        switchesString.forEach(function (switchString) {
            jekyllSwitches += '--' + switchString;
        });
    }

    return jekyllSwitches;
}

// // Export content
// function taskExport(sourceFormat, exportFormat) {
//     'use strict';
//     console.log('Exporting content...');
// }

// Processes images with gulp if -t images
function taskImages(book, subdir) {
    'use strict';

    var gulpProcess = spawn(
        'gulp',
        ['--book', book, '--language', subdir]
    );
    logProcess(gulpProcess, 'gulp');
}

// // Refresh the search index
// function taskIndex(format) {
//     'use strict';
//     console.log('Generating search index...');
// }

// Install Ruby and Node dependencies.
// To do: add checks for other Electric Book dependencies.
function taskInstall() {
    'use strict';

    console.log(
        'Running Bundler to install Ruby gem dependencies...\n' +
        'If you get errors, check that Bundler is installed (https://bundler.io).'
    );
    var bundleProcess = spawn(
        'bundle',
        ['install']
    );
    logProcess(bundleProcess, 'Bundler');

    console.log(
        'Running npm to install Node modules...\n' +
        'If you get errors, check that Node.js is installed (https://nodejs.org).'
    );
    var npmProcess = spawn(
        'npm',
        ['install']
    );
    logProcess(npmProcess, 'npm');
}

// Create an Electric Book output
function taskOutput(format) {
    'use strict';

    // print-pdf and screen-pdf
    if (format === 'print-pdf' || format === 'screen-pdf') {
        var filePath = fsPath.normalize(process.cwd() + '/_output/' + outputFilename(format));
        jekyll(
            'build',
            configs('_config.' + format + '.yml'),
            argv.baseurl,
            switches(),
            outputPDF
        );

        console.log('Your PDF will be saved to ' + filePath);
    }

    // web
    if (format === 'web') {
        jekyll('serve', configs('_config.web.yml'), argv.baseurl, switches());
    }

    // To do: epub, app
}

// Execution
// ---------

// Check that the project contains required files
if (argv.task === 'check') {
    checkProjectSetup(argv.book);
}

// Output a project or a book
if (argv.task === 'output') {
    taskOutput(argv.format);
}

// Process images
if (argv.task === 'images') {
    taskImages(argv.book, argv.subdir);
}

// Install dependencies
if (argv.task === 'install') {
    taskInstall();
}
