package id.sch.smpthhk.exambrowser;

import android.app.AlertDialog;
import android.content.Context;
import android.text.InputType;
import android.widget.EditText;
import android.widget.LinearLayout;

public class ExitPasswordDialog {

    public interface OnPasswordValidatedListener {
        void onSuccess();

        void onFailure();
    }

    public static void show(Context context, OnPasswordValidatedListener listener) {
        AlertDialog.Builder builder = new AlertDialog.Builder(context);
        builder.setTitle("Password Keamanan Exambrowser");
        builder.setMessage("Masukkan password keamanan untuk keluar dari mode ujian (Default: 12345):");

        final EditText input = new EditText(context);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setHint("Masukkan Password...");

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT);
        input.setLayoutParams(lp);
        builder.setView(input);

        builder.setPositiveButton("Keluar Ujian", (dialog, which) -> {
            String enteredPassword = input.getText().toString().trim();
            if ("12345".equals(enteredPassword) || "THHK2026".equals(enteredPassword)) {
                if (listener != null)
                    listener.onSuccess();
            } else {
                if (listener != null)
                    listener.onFailure();
            }
        });

        builder.setNegativeButton("Batal", (dialog, which) -> dialog.cancel());

        AlertDialog alertDialog = builder.create();
        alertDialog.show();
    }
}