const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// --- بيانات الاعتماد الخاصة بك للتجربة المحلية فقط ---
const CLIENT_ID = "935417401055-h22umchi7s49c841hju6mmemfhrod8mv.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04kKfGNhamyCoCgYIARAAGAQSNwF-L9Irqy1p44YDlLHTCSqp1n6Gyg4CBr_Stqw_RkjyFYfglwayNrkocAzQjr4BNCl2CjGIyXI";
const CHANNEL_URL = "https://www.youtube.com/@MohamedAbuAlAsateer"; 

// إعداد مصادقة يوتيوب API
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// 2. دالة جلب العنوان وتحميل أحدث فيديو
function downloadLatestVideo() {
    console.log("جاري استخراج عنوان أحدث فيديو من قناتك...");
    
    let title = "فيديو جديد";
    try {
        // استخراج العنوان الأصلي للفيديو
        const titleCmd = `yt-dlp --print "%(title)s" --playlist-items 1 "${CHANNEL_URL}"`;
        title = execSync(titleCmd, { encoding: 'utf-8' }).trim();
        console.log(`العنوان الأصلي المكتشف: ${title}`);
        
        console.log("جاري تحميل الفيديو (قد يستغرق ذلك بعض الوقت حسب الحجم)...");
        // تحميل الفيديو بأفضل جودة بصيغة mp4
        const downloadCmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" -o "latest_video.mp4" --playlist-items 1 "${CHANNEL_URL}"`;
        execSync(downloadCmd, { stdio: 'inherit' });
        
        return { file: "latest_video.mp4", title: title };
    } catch (error) {
        console.error("حدث خطأ أثناء تحميل الفيديو:", error.message);
        return null;
    }
}

// 3. دالة القص (دقيقة واحدة بأبعاد عمودية للهواتف)
function processVideoToShorts(inputFile) {
    console.log("جاري تحويل أول دقيقة من الفيديو إلى مقطع ريلز (9:16)...");
    const outputFile = "short_1.mp4";
    
    try {
        // أمر FFmpeg لقص أول 59 ثانية وعمل زوم للمنتصف ليصبح عمودياً
        const ffmpegCmd = `ffmpeg -y -ss 0 -i ${inputFile} -t 59 -vf "crop=ih*(9/16):ih,scale=1080:1920" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k ${outputFile}`;
        execSync(ffmpegCmd, { stdio: 'inherit' });
        console.log(`تم إنشاء مقطع الريلز بنجاح: ${outputFile}`);
        return outputFile;
    } catch (error) {
        console.error("حدث خطأ أثناء قص الفيديو بواسطة FFmpeg:", error.message);
        return null;
    }
}

// 4. دالة الرفع والجدولة لليوم التالي
async function uploadAndSchedule(filePath, originalTitle) {
    console.log("جاري رفع مقطع الريلز إلى يوتيوب وجدولته...");
    
    // ضبط العنوان ليتوافق مع شروط يوتيوب (أقل من 100 حرف مع الهاشتاقات)
    const safeTitle = originalTitle.length > 75 
        ? originalTitle.substring(0, 75) + " #shorts #ريلز" 
        : originalTitle + " #shorts #ريلز";

    // حساب وقت النشر (غداً الساعة 3 عصراً بتوقيت جرينتش UTC)
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
                    categoryId: '22' // فئة المدونات والناس
                },
                status: {
                    privacyStatus: 'private', // يجب أن يكون خاصاً لتفعيل الجدولة
                    publishAt: publishTimeIso,
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(filePath)
            }
        });
        
        console.log(`\n==================================================`);
        console.log(`✅ تمت العملية بنجاح وجدولة الريلز!`);
        console.log(`📅 تاريخ النشر المجدول: ${publishTimeIso}`);
        console.log(`📝 عنوان الفيديو المرفوع: ${safeTitle}`);
        console.log(`🆔 معرّف الفيديو (Video ID): ${response.data.id}`);
        console.log(`==================================================`);
    } catch (error) {
        console.error("حدث خطأ أثناء الرفع إلى API يوتيوب:", error.message);
    }
}

// الدالة الرئيسية للتنفيذ
async function main() {
    const videoData = downloadLatestVideo();
    
    if (videoData && fs.existsSync(videoData.file)) {
        const shortFile = processVideoToShorts(videoData.file);
        
        if (shortFile && fs.existsSync(shortFile)) {
            await uploadAndSchedule(shortFile, videoData.title);
            
            // تنظيف الملفات المؤقتة بعد الانتهاء لتوفير المساحة
            try {
                fs.unlinkSync(videoData.file);
                fs.unlinkSync(shortFile);
                console.log("تم تنظيف الملفات المؤقتة من الجهاز.");
            } catch (e) {
                console.log("لم يتم حذف الملفات المؤقتة، يمكنك حذفها يدوياً.");
            }
        }
    } else {
        console.log("فشل في العثور على الفيديو الأساسي أو تحميله.");
    }
}

// بدء التشغيل
main();
