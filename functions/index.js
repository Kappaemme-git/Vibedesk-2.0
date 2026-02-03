const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhook = defineSecret("STRIPE_WEBHOOK");

let stripeClient = null;

exports.stripeWebhook = onRequest(
  { region: "us-central1", secrets: [stripeSecret, stripeWebhook] },
  async (req, res) => {
    if (!stripeClient) {
      stripeClient = new Stripe(stripeSecret.value(), { apiVersion: "2023-10-16" });
    }

    const sig = req.headers["stripe-signature"];
    const webhookSecret = stripeWebhook.value();
    let event;

    try {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const uid = session.client_reference_id || null;
      const email = session.customer_details?.email || session.customer_email || null;

      try {
        if (uid) {
          await admin.firestore().collection("users").doc(uid).set(
            {
              isPremium: true,
              premiumSince: admin.firestore.FieldValue.serverTimestamp(),
              premiumSource: "stripe",
              stripeCustomerId: session.customer || null,
              stripeSessionId: session.id
            },
            { merge: true }
          );
        } else if (email) {
          const snap = await admin.firestore().collection("users").where("email", "==", email).limit(1).get();
          if (!snap.empty) {
            await snap.docs[0].ref.set(
              {
                isPremium: true,
                premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                premiumSource: "stripe",
                stripeCustomerId: session.customer || null,
                stripeSessionId: session.id
              },
              { merge: true }
            );
          } else {
            console.warn("No user found for email", email);
          }
        } else {
          console.warn("No uid or email in checkout session");
        }
      } catch (err) {
        console.error("Failed to update premium status", err);
        return res.status(500).send("Failed to update premium status");
      }
    }

    res.json({ received: true });
  }
);
