const puppeteer = require('puppeteer');
const path = require('path');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setCookies(page, cookies) {
    await page.setCookie(...cookies);
}

async function createPost(page, postContent) {
    console.log('Navigating to Threads homepage...');
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2' });
    console.log('Waiting for Create button...');
    await page.waitForSelector('svg[aria-label="Create"]', { timeout: 60000 });

    console.log('Clicking Create button...');
    await page.evaluate(() => {
        document.querySelector('svg[aria-label="Create"]').parentElement.click();
    });

    console.log('Waiting for contenteditable div...');
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 60000 });
    console.log('Typing post content...');
    await page.type('div[contenteditable="true"]', postContent);

    await delay(3000); // Increased delay
}

async function addSecondThread(page, secondThreadContent) {
    console.log('Waiting for Add to thread button...');
    await page.waitForFunction(() => {
        return [...document.querySelectorAll('span')].some(span => span.innerText === 'Add to thread');
    });

    console.log('Clicking Add to thread button...');
    const spanElement = await page.evaluateHandle(() => {
        return [...document.querySelectorAll('span')].find(span => span.innerText === 'Add to thread');
    });

    if (spanElement) {
        await spanElement.asElement().click();
    }

    console.log('Waiting for second contenteditable div...');
    await page.waitForFunction(() => {
        return document.querySelectorAll('div[contenteditable="true"]').length > 1;
    });

    const secondContentEditableDiv = await page.evaluateHandle(() => {
        return document.querySelectorAll('div[contenteditable="true"]')[1];
    });

    if (secondContentEditableDiv) {
        await secondContentEditableDiv.asElement().focus();
        console.log('Typing second thread content...');
        await page.keyboard.type(secondThreadContent);
    }

    await delay(3000); // Increased delay
}

async function addImageToPost(page, filePath) {
    console.log('Waiting for Attach media button...');
    await page.waitForSelector('svg[aria-label="Attach media"]', { timeout: 60000 });
    console.log('Clicking Attach media button...');
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('svg[aria-label="Attach media"]')
    ]);

    console.log(`Selecting file ${filePath}...`);
    await fileChooser.accept([filePath]);
    await delay(3000); // Increased delay
}

async function submitPost(page) {
    console.log('Submitting post...');
    await page.evaluate(() => {
        document.querySelectorAll('div').forEach(div => {
            if (div.innerText === 'Post') {
                div.click();
            }
        });
    });

    await delay(3000); // Ensure the post submission completes
}

async function retryOperation(operation, retries = 5, delayMs = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await operation();
            return; // Operation succeeded
        } catch (error) {
            console.error(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt < retries) {
                await delay(delayMs);
            } else {
                throw error; // Re-throw the last error if all attempts fail
            }
        }
    }
}

// Wrap the main operations in retryOperation
async function postponePost(postContent, secondThreadContent, imagePath, cookies) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    try {
        await setCookies(page, cookies);
        await retryOperation(() => createPost(page, postContent));
        await retryOperation(() => addSecondThread(page, secondThreadContent));
        if (imagePath) {
            await retryOperation(() => addImageToPost(page, imagePath));
        }
        await retryOperation(() => submitPost(page));
    } catch (error) {
        console.error('Error during the posting process:', error);
    } finally {
        await browser.close();
    }
}

// New function to schedule the post
function schedulePost(postContent, secondThreadContent, imagePath, delayTime, cookies) {
    setTimeout(() => {
        postponePost(postContent, secondThreadContent, imagePath, cookies);
    }, delayTime);
}

// Function to schedule multiple posts in batches with a 2-hour wait between batches for multiple cookies
async function scheduleMultiplePostsInBatchesForMultipleCookies(posts, batchSize, interval, allCookies) {
    for (let i = 0; i < allCookies.length; i++) {
        const cookies = allCookies[i];
        console.log(`Using cookie set ${i + 1}`);
        
        for (let j = 0; j < posts.length; j += batchSize) {
            const batch = posts.slice(j, j + batchSize);

            // Post all tweets in the current batch
            for (const post of batch) {
                schedulePost(post.content, post.secondContent, post.imagePath, 0, cookies); // Post immediately
            }

            // Wait for 2 hours before posting the next batch
            if (j + batchSize < posts.length) {
                console.log('Waiting for 2 hours before posting the next batch...');
                await delay(interval);
            }
        }
    }
}

const postsForCookies = [
    [

        // First account
        { content: 'First post content for first cookie set', secondContent: 'First second thread content', imagePath: './assets/black_image.jpg' },
        { content: 'Second post content for first cookie set', secondContent: 'Second second thread content', imagePath: './assets/black_image.jpg' },
        { content: 'Third post content for first cookie set', secondContent: 'Third second thread content', imagePath: './assets/black_image.jpg' },
        // Add more posts as needed
    ],
    [
        // Second account
        { content: 'First post content for second cookie set', secondContent: 'First second thread content', imagePath: './assets/black_image.jpg' },
        { content: 'Second post content for second cookie set', secondContent: 'Second second thread content', imagePath: './assets/black_image.jpg' },
        { content: 'Third post content for second cookie set', secondContent: 'Third second thread content', imagePath: './assets/black_image.jpg' },
        // Add more posts as needed
    ]
];

const allCookies = [
    [
        {
            'name': 'cb',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': true,
            'secure': true
        },
        {
            'name': 'csrftoken',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'dpr',
            'value': '1.25',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'ds_user_id',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'ig_did',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'mid',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': true,
            'secure': true
        },
        {
            'name': 'sessionid',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': true,
            'secure': true
        }
    ],
    [
        {
            'name': 'cb',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': true,
            'secure': true
        },
        {
            'name': 'csrftoken',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'dpr',
            'value': '1.25',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'ds_user_id',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'ig_did',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': false,
            'secure': true
        },
        {
            'name': 'mid',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': true,
            'secure': true
        },
        {
            'name': 'sessionid',
            'value': '',
            'domain': '.threads.net',
            'path': '/',
            'httpOnly': true,
            'secure': true
        }
    ]
    // Add more sets of cookies as needed
];

const batchSize = 3; // Number of posts per batch
const interval = 60 * 1000; // 1 minute in milliseconds for testing

async function main() {
    for (let i = 0; i < allCookies.length; i++) {
        const cookies = allCookies[i];
        const posts = postsForCookies[i];
        console.log(`Using cookie set ${i + 1}`);
        
        for (let j = 0; j < posts.length; j += batchSize) {
            const batch = posts.slice(j, j + batchSize);

            // Post all tweets in the current batch
            for (const post of batch) {
                schedulePost(post.content, post.secondContent, post.imagePath, 0, cookies); // Post immediately
            }

            // Wait for 2 hours before posting the next batch
            if (j + batchSize < posts.length) {
                console.log('Waiting for 2 hours before posting the next batch...');
                await delay(interval);
            }
        }
    }
}

main();
