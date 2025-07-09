const path = require("path");
const logger = require("../utils/logger");
const { circularStringify } = require("../utils/helper");
const fs = require("fs");
const { MultiBar, Presets } = require("cli-progress");
const { updateState, clearDownload, getState } = require("./downloadState");


 const multiBar = new MultiBar({
   clearOnComplete: false,
   hideCursor: true,
   format: "{filename} |{bar}| {percentage}% | {value}/{total} bytes"
 }, Presets.shades_classic);

 const downloadMessageMedia = async (client, message, mediaPath) => {
   if (!client || !message?.media || !mediaPath) {
     logger.error("Client, message, and mediaPath are required");
     return false;
   }

   const mediaId = String(message.id);
  // Determine resume offset: file size vs persisted offset
   let existingSize = 0;
   if (fs.existsSync(mediaPath)) existingSize = fs.statSync(mediaPath).size;
   const { offset: savedOffset } = getState(mediaId);
   const startOffset = Math.max(existingSize, savedOffset);

   // Create a bar for this file
   const fileName = `${mediaId}_${path.basename(mediaPath)}`;
   const bar = multiBar.create(0, 0, { filename: fileName });

   // Open file in append mode
   const output = fs.createWriteStream(mediaPath, { flags: "a" });

   await client.downloadMedia(message, {
     outputFile: output,
     offset: startOffset,
     progressCallback: (downloaded, total) => {
      // Persist updated offset
      updateState(mediaId, { offset: absolute, total, outputFile: mediaPath });
      // On first callback, set total and initialize bar
      if (bar.getTotal() !== total) {
        bar.setTotal(total);
        bar.update(startOffset);
      }

      const absolute = startOffset + downloaded;
      bar.update(absolute);

      // Persist absolute offset and total
      updateState(mediaId, { offset: absolute, total, outputFile: mediaPath });

       if (startOffset + downloaded === total) {
         bar.stop();
         logger.success(`File ${fileName} downloaded successfully`);
        clearDownload(mediaId);
       }
     },
   });

   return true;
 };