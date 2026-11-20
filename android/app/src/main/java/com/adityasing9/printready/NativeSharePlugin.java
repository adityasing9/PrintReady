package com.adityasing9.printready;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {

    private String normalizePhone(String rawPhone) {
        if (rawPhone == null) return null;
        String digits = rawPhone.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;
        // If 10 digits (standard Indian mobile number, e.g. 9876543210), prepend country code 91
        if (digits.length() == 10) {
            digits = "91" + digits;
        } else if (digits.length() == 11 && digits.startsWith("0")) {
            digits = "91" + digits.substring(1);
        }
        return digits;
    }

    @PluginMethod
    public void shareFiles(PluginCall call) {
        try {
            JSArray filesArray = call.getArray("files");
            if (filesArray == null || filesArray.length() == 0) {
                call.reject("No files provided");
                return;
            }

            String target = call.getString("target", "chooser"); // "whatsapp", "email", "chooser"
            String phone = call.getString("phone", "");
            String email = call.getString("email", "");
            String subject = call.getString("subject", "Print Request - Documents Attached");

            Context context = getContext();
            File sharedDir = new File(context.getCacheDir(), "shared_files");
            if (!sharedDir.exists()) {
                sharedDir.mkdirs();
            }

            // Clean previous shared files in cache
            File[] existing = sharedDir.listFiles();
            if (existing != null) {
                for (File f : existing) {
                    try {
                        f.delete();
                    } catch (Exception ignored) {}
                }
            }

            ArrayList<Uri> uriList = new ArrayList<>();
            boolean allPdf = true;
            boolean allImage = true;

            for (int i = 0; i < filesArray.length(); i++) {
                JSONObject fileObj = filesArray.getJSONObject(i);
                String rawName = fileObj.getString("name");
                String base64Data = fileObj.getString("base64");
                String mimeType = fileObj.optString("mimeType", "*/*").toLowerCase();

                boolean isPdf = mimeType.contains("pdf") || rawName.toLowerCase().endsWith(".pdf");
                boolean isImg = mimeType.startsWith("image/") || rawName.toLowerCase().endsWith(".jpg") || rawName.toLowerCase().endsWith(".jpeg") || rawName.toLowerCase().endsWith(".png");
                if (!isPdf) allPdf = false;
                if (!isImg) allImage = false;

                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String safeName = i + "_" + rawName.replaceAll("[\\\\/:*?\"<>|]", "_");
                File destFile = new File(sharedDir, safeName);
                FileOutputStream fos = new FileOutputStream(destFile);
                fos.write(bytes);
                fos.flush();
                fos.close();
                destFile.setReadable(true, false);

                Uri contentUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    destFile
                );
                uriList.add(contentUri);
            }

            if (uriList.isEmpty()) {
                call.reject("Could not prepare files");
                return;
            }

            String mimeTypeToSet = "*/*";
            if (allPdf) {
                mimeTypeToSet = "application/pdf";
            } else if (allImage) {
                mimeTypeToSet = "image/*";
            }

            Intent intent;
            if (uriList.size() > 1) {
                intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
                intent.setType(mimeTypeToSet);
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uriList);
            } else {
                intent = new Intent(Intent.ACTION_SEND);
                intent.setType(mimeTypeToSet);
                intent.putExtra(Intent.EXTRA_STREAM, uriList.get(0));
            }

            // Set ClipData with all URIs to guarantee Android framework grants read permissions to all attachments
            ClipData clipData = ClipData.newUri(context.getContentResolver(), "PrintReady Documents", uriList.get(0));
            for (int i = 1; i < uriList.size(); i++) {
                clipData.addItem(new ClipData.Item(uriList.get(i)));
            }
            intent.setClipData(clipData);

            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            PackageManager pm = context.getPackageManager();

            if ("whatsapp".equalsIgnoreCase(target)) {
                String pkg = null;
                try {
                    pm.getPackageInfo("com.whatsapp", PackageManager.GET_ACTIVITIES);
                    pkg = "com.whatsapp";
                } catch (Exception e1) {
                    try {
                        pm.getPackageInfo("com.whatsapp.w4b", PackageManager.GET_ACTIVITIES);
                        pkg = "com.whatsapp.w4b";
                    } catch (Exception e2) {
                        pkg = null;
                    }
                }

                if (pkg != null) {
                    intent.setPackage(pkg);
                    for (Uri u : uriList) {
                        context.grantUriPermission(pkg, u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    }
                }

                // Automatically target the selected / saved shop WhatsApp number
                String cleanPhone = normalizePhone(phone);
                if (cleanPhone != null && !cleanPhone.isEmpty()) {
                    String jid = cleanPhone + "@s.whatsapp.net";
                    intent.putExtra("jid", jid);
                    intent.putExtra("jids", jid);
                    intent.putExtra(Intent.EXTRA_PHONE_NUMBER, cleanPhone);
                    intent.putExtra("phone", cleanPhone);
                    intent.putExtra("address", cleanPhone);
                }
            } else if ("email".equalsIgnoreCase(target)) {
                if (email != null && !email.trim().isEmpty()) {
                    intent.putExtra(Intent.EXTRA_EMAIL, new String[]{ email.trim() });
                }
                if (subject != null && !subject.trim().isEmpty()) {
                    intent.putExtra(Intent.EXTRA_SUBJECT, subject.trim());
                }
            }

            // Grant read permission to all matching activities
            List<ResolveInfo> resInfoList = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                for (Uri u : uriList) {
                    context.grantUriPermission(packageName, u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
            }

            // Launch Activity
            try {
                if ("whatsapp".equalsIgnoreCase(target) && intent.getPackage() != null) {
                    getActivity().startActivity(intent);
                } else if ("email".equalsIgnoreCase(target)) {
                    Intent chooser = Intent.createChooser(intent, "Send Files to Print Shop");
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(chooser);
                } else {
                    Intent chooser = Intent.createChooser(intent, "Send Files to Print Shop");
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(chooser);
                }
                call.resolve(new JSObject().put("success", true).put("count", uriList.size()));
            } catch (Exception launchEx) {
                // Fallback to system chooser if direct package failed
                intent.setPackage(null);
                intent.removeExtra("jid");
                Intent chooser = Intent.createChooser(intent, "Send Files to Print Shop");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(chooser);
                call.resolve(new JSObject().put("success", true).put("count", uriList.size()));
            }
        } catch (Exception e) {
            call.reject("Failed to share files: " + e.getMessage(), e);
        }
    }
}
