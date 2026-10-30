import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    // 1. Only POST requests are allowed
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
      });
    }

    // 2. Verify the webhook secret
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-webhook-secret");

    if (
      !expectedSecret ||
      !receivedSecret ||
      receivedSecret !== expectedSecret
    ) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 3. Read environment variables
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!telegramToken || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Required environment variables are missing");
    }

    // 4. Create Supabase server client
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // 5. Read Database Webhook payload
    const payload = await req.json();

    if (
      payload.type !== "UPDATE" ||
      payload.table !== "applications" ||
      payload.schema !== "public"
    ) {
      return Response.json({
        success: true,
        message: "Event ignored",
      });
    }

    const application = payload.record;
    const oldApplication = payload.old_record;

    if (
      !application ||
      !oldApplication ||
      !application.id ||
      !application.candidate_id
    ) {
      return Response.json(
        { error: "Invalid application payload" },
        { status: 400 },
      );
    }

    // 6. Send notification only if status changed
    if (application.status === oldApplication.status) {
      return Response.json({
        success: true,
        message: "Status did not change",
      });
    }

    // 7. Find the candidate who submitted the application
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, telegram_id, full_name")
      .eq("id", application.candidate_id)
      .maybeSingle();

    if (candidateError) {
      throw candidateError;
    }

    if (!candidate) {
      return Response.json(
        { error: "Candidate not found" },
        { status: 404 },
      );
    }

    // 8. Get candidate's Telegram chat ID
    const chatId = candidate.telegram_id;

    if (!chatId) {
      return Response.json({
        success: true,
        message: "Candidate has no Telegram ID",
      });
    }

    // 9. Prepare notification message
    const candidateName = candidate.full_name || "Candidate";

    const message = [
      `Hello, ${candidateName}!`,
      "",
      "Your application status has been updated.",
      "",
      `Previous status: ${oldApplication.status ?? "Not set"}`,
      `New status: ${application.status ?? "Not set"}`,
      "",
      "Please check your application for further details.",
    ].join("\n");

    // 10. Send Telegram message
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      },
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error(
        "Telegram delivery failed:",
        telegramResult.description,
      );

      return Response.json(
        { error: "Telegram message delivery failed" },
        { status: 502 },
      );
    }

    // 11. Return success
    return Response.json({
      success: true,
      applicationId: application.id,
      status: application.status,
      messageSent: true,
    });
  } catch (error) {
    console.error("Application notification error:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});