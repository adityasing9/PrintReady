package com.adityasing9.printready;

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

    @PluginMethod
    public void shareFiles(PluginCall call) {
        try {
            JSArray filesArray = call.getArray("files");
            if (filesArray == null || filesArray.length() == 0) {
                call.reject("No files provided");
                return;
            }

            String text = call.getString("text", "");
            String target = call.getString("target", "chooser"); // "whatsapp", "email", "chooser"
            String phone = call.getString("phone", "");
            String email = call.getString("email", "");
            String subject = call.getString("subject", "Print Request - Documents Attached");

            Context context = getContext();
            File sharedDir = new File(context.getCacheDir(), "shared_files");
            if (!sharedDir.exists()) {
                sharedDir.mkdirs();
            }

            // Clean up previous shared files in cache
            File[] existing = sharedDir.listFiles();
            if (existing != null) {
                for (File f : existing) {
                    try {
                        f.delete();
                    } catch (Exception ignored) {}
                }
            }

            ArrayList<Uri> uriList = new ArrayList<>();
            String primaryMimeType = "*/*";

            for (int i = 0; i < filesArray.length(); i++) {
                JSONObject fileObj = filesArray.getJSONObject(i);
                String fileName = fileObj.getString("name");
                String base64Data = fileObj.getString("base64");
                String mimeType = fileObj.optString("mimeType", "*/*");
                if (i == 0 && mimeType != null && !mimeType.isEmpty()) {
                    primaryMimeType = mimeType;
                }

                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                File destFile = new File(sharedDir, fileName);
                FileOutputStream fos = new FileOutputStream(destFile);
                fos.write(bytes);
                fos.flush();
                fos.close();

                Uri contentUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    destFile
                );
                uriList.add(contentUri);
            }

            Intent intent;
            if (uriList.size() > 1) {
                intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
                intent.setType("*/*");
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uriList);
            } else {
                intent = new Intent(Intent.ACTION_SEND);
                intent.setType(primaryMimeType);
                intent.putExtra(Intent.EXTRA_STREAM, uriList.get(0));
            }

            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (text != null && !text.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, text);
            }

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
                    if (phone != null && !phone.trim().isEmpty()) {
                        String cleanDigits = phone.replaceAll("[^0-9]", "");
                        if (!cleanDigits.isEmpty()) {
                            intent.putExtra("jid", cleanDigits + "@s.whatsapp.net");
                        }
                    }
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
                    Intent chooser = Intent.createChooser(intent, "Send Email with Documents");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(chooser);
                } else {
                    Intent chooser = Intent.createChooser(intent, "Share Documents via...");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(chooser);
                }
                call.resolve(new JSObject().put("success", true));
            } catch (Exception launchEx) {
                // Fallback to general system chooser if direct package failed
                intent.setPackage(null);
                intent.removeExtra("jid");
                Intent chooser = Intent.createChooser(intent, "Share Documents");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(chooser);
                call.resolve(new JSObject().put("success", true));
            }
        } catch (Exception e) {
            call.reject("Failed to share files: " + e.getMessage(), e);
        }
    }
}
