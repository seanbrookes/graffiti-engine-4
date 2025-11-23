import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const PORT = 9999;
const EXPECTED_API_KEY = "__DEV_KEY__"; // Keep this secret
const BLOG_ROOT_DIR = 'local-web-cloud'; // The root folder where posts will be saved (Updated)
const LOG_DIR = 'log';

const server = express();
server.use(express.json());
server.use(cors());
server.use(express.urlencoded({ extended: true }));
// --- HELPER: Logging Function ---
const wh_log = (msg, isLogging) => {
    if (isLogging !== 'true') return;

    // Use absolute path for robustness
    const logPath = path.resolve(LOG_DIR);
    const date = new Date();
    const dateString = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
    const logFile = path.join(logPath, `log_${dateString}.log`);
    const timestamp = date.toISOString();

    // Ensure log directory exists, then append message
    fs.mkdir(logPath, { recursive: true, mode: 0o755 })
        .then(() => {
            fs.appendFile(logFile, `[${timestamp}] ${msg}\n`);
        })
        .catch(err => {
            console.error(`[FATAL LOG ERROR] Could not write to log file: ${err.message}`);
        });
};


/* POST: /api/inbox - generate post file
*/
server.post('/api/inbox', async (req, res) => {
    // Note: IsIndex is now destructured along with other properties
    const { 
        IsLogging, 
        ApiKey, 
        PostPublishYear, 
        PostPublishMonth, 
        PostSlug, 
        PostBody,
        IsIndex // <--- NEW: Flag for index.html generation
    } = req.body;

    console.log('| GE inbox 1 req.body', req.body);
    // Start logging lifecycle
    wh_log('| GE: inbox start lifecycle', IsLogging);
    console.log('| GE inbox 2');

    // 1. SECURITY CHECK (Authentication)
    if (ApiKey !== EXPECTED_API_KEY) {
      console.log('| GE inbox 3');
      wh_log('| GE: Auth failed. Invalid Key.', IsLogging);
        return res.status(403).json({ 
            status: "error", 
            message: `Invalid API Key expected[${EXPECTED_API_KEY}] received[${ApiKey}]` 
        });
    }
    console.log('| GE inbox 4');

    wh_log('| GE: Auth success.', IsLogging);
    console.log('| GE inbox 5');

    // 2. INPUT VALIDATION
    // Only require PostPublishYear, PostPublishMonth, and PostSlug if it is NOT the index file.
    if (IsIndex !== 'true' && (!PostPublishYear || !PostPublishMonth || !PostSlug || !PostBody)) {
      console.log('| GE inbox 6');
      wh_log('| GE: Missing required fields for non-index post.', IsLogging);
        return res.status(400).json({ 
            status: "error", 
            message: "Missing one or more required fields (Year, Month, Slug, Body) for post publishing." 
        });
    }
    console.log('| GE inbox 7');

    
    // 3. DEFINE PATHS & SANITIZE INPUTS (Conditional Logic)
    let fileName, fileDir, pubYear, pubMonth, slug;
    const content = PostBody; 
    
    if (IsIndex === 'true') {
        // --- Index File Logic ---
        fileName = 'index.html';
        fileDir  = BLOG_ROOT_DIR; // Save directly in the root folder
        pubYear  = 'N/A';
        pubMonth = 'N/A';
        slug     = 'index';
        wh_log('| GE: Processing index.html', IsLogging);

    } else {
        // --- Regular Post Logic ---
        // Use regex to only allow numbers for year/month and safe characters for slug
        pubYear  = PostPublishYear.replace(/[^0-9]/g, '');
        pubMonth = PostPublishMonth.replace(/[^0-9]/g, '');
        // Allow alphanumeric, underscores, and dashes for the slug
        slug     = PostSlug.replace(/[^a-zA-Z0-9-_]/g, ''); 
        
        fileName = `${slug}.html`;
        // Create the directory path: local-web-cloud/year/month
        fileDir  = path.join(BLOG_ROOT_DIR, pubYear, pubMonth);
        wh_log(`| GE: Processing ${slug} (${pubYear}/${pubMonth})`, IsLogging);
    }
    
    console.log('| GE inbox 9');
    
    // Create the full path: local-web-cloud/[year/month/]slug.html or local-web-cloud/index.html
    const filePath = path.join(fileDir, fileName);
    
    // Resolve to the absolute path for file operations
    const absoluteFileDir = path.resolve(fileDir);
    const absoluteFilePath = path.resolve(filePath);

    wh_log(`| GE: Target path: ${absoluteFilePath}`, IsLogging);
    console.log('| GE inbox 11');

    try {
        // 5. CREATE DIRECTORY (if it doesn't exist)
        // { recursive: true } handles creating nested directories, safe for root or nested paths
        await fs.mkdir(absoluteFileDir, { recursive: true, mode: 0o755 });
        console.log('| GE inbox 12');
        wh_log(`| GE: Directory available/created: ${absoluteFileDir}`, IsLogging);

        // 6. WRITE FILE (Overwrites existing file)
        await fs.writeFile(absoluteFilePath, content, 'utf8');
        console.log('| GE inbox 13');
        wh_log('| GE: File write success.', IsLogging);

        // 7. SUCCESS RESPONSE
        return res.status(200).json({
            status: "success",
            message: `${fileName} generated successfully.`,
            path: filePath
        });

    } catch (error) {
        wh_log(`| GE: File system operation failed: ${error.message}`, IsLogging);
        console.error("File System Error:", error);
        
        // 8. SERVER ERROR RESPONSE
        return res.status(500).json({
            status: "error",
            message: "Server failed to write the file.",
            details: error.message
        });
    }
});

server.get('*', (req, res) => {
  res.send('nothing here');
});

server.listen(PORT, () => {
  console.log('Graffiti Engine 4 inbox is running on port', PORT);
});