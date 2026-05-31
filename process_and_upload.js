const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// 1. قراءة متغيرات البيئة من GitHub Secrets
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// إعداد مصادقة يوتيوب API
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// 2. دالة جلب العنوان وتحميل أحدث فيديو
function downloadLatestVideo() {
    console.log("جاري استخراج عنوان أحدث فيديو...");
    const url = `https://www.youtube.com/channel/${CHANNEL_ID}`;
    
    let title = "فيديو جديد";
    try {
        // استخراج العنوان فقط
        const titleCmd = `yt-dlp --print "%(title)s" --playlist-items 1 "${url}"`;
        title = execSync(titleCmd, { encoding: 'utf-8' }).trim();
        console.log(`العنوان الأصلي: ${title}`);
        
        console.log("جاري تحميل الفيديو...");
        // تحميل الفيديو بأفضل جودة ودمج الصوت والصورة
        const downloadCmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" -o "latest_video.mp4" --playlist-items 1 "${url}"`;
        execSync(downloadCmd, { stdio: 'inherit' });
        
        return { file: "latest_video.mp4", title: title };
    } catch (error) {
        console.error("حدث خطأ أثناء تحميل الفيديو:", error.message);
        return null;
    }
}

// 3. دالة القص (دقيقة واحدة بأبعاد عمودية)
function processVideoToShorts(inputFile) {
    console.log("جاري تحويل أول دقيقة إلى مقطع ريلز...");
    const outputFile = "short_1.mp4";
    
    try {
        const ffmpegCmd = `ffmpeg -y -ss 0 -i ${inputFile} -t 59 -vf "crop=ih*(9/16):ih,scale=1080:1920" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k ${outputFile}`;
        execSync(ffmpegCmd, { stdio: 'inherit' });
        console.log(`تم إنشاء المقطع: ${outputFile}`);
        return outputFile;
    } catch (error) {
        console.error("حدث خطأ أثناء قص الفيديو:", error.message);
        return null;
    }
}

// 4. دالة الرفع والجدولة
async function uploadAndSchedule(filePath, originalTitle) {
    console.log("جاري رفع وجدولة الريلز...");
    
    // تقصير العنوان إذا كان طويلاً وإضافة الهاشتاقات
    const safeTitle = originalTitle.length > 75 
        ? originalTitle.substring(0, 75) + " #shorts #ريلز" 
        : originalTitle + " #shorts #ريلز";

    // حساب وقت النشر ليوم غد الساعة 3 عصراً (بتوقيت جرينتش UTC)
    const publishDate = new Date();
    publishDate.setUTCDate(publishDate.getUTCDate() + 1);
    publishDate.setUTCHours(15, 0, 0, 0);
    const publishTimeIso = publishDate.toISOString();

    try {
        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: safeTitle,
                    description: `${originalTitle}\n\n#shorts #ريلز #youtube_shorts #يوتيوب`,
                    tags: ['shorts', 'ريلز', 'يوتيوب', 'short'],
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'private', // الجدولة تتطلب أن يكون الفيديو خاصاً
                    publishAt: publishTimeIso,
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(filePath)
            }
        });
        
        console.log(`تمت الجدولة بنجاح لتاريخ: ${publishTimeIso}`);
        console.log(`عنوان الريلز: ${safeTitle}`);
        console.log(`معرّف الفيديو: ${response.data.id}`);
    } catch (error) {
        console.error("حدث خطأ أثناء رفع الفيديو:", error.message);
    }
}

// الدالة الرئيسية للتشغيل
async function main() {
    const videoData = downloadLatestVideo();
    
    if (videoData && fs.existsSync(videoData.file)) {
        const shortFile = processVideoToShorts(videoData.file);
        
        if (shortFile && fs.existsSync(shortFile)) {
            await uploadAndSchedule(shortFile, videoData.title);
            console.log("اكتملت العملية! تم قص دقيقة واحدة وجدولتها كـ ريلز بنفس العنوان.");
        }
    } else {
        console.log("فشل العثور على الفيديو الأساسي.");
    }
}

// بدء التنفيذ
main();
