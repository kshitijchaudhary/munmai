import mongoose from "mongoose";

const telemetryEventSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["event", "error", "server_error"],
      required: true,
    },
    level: {
      type: String,
      enum: ["info", "warn", "error"],
      default: "info",
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      trim: true,
      default: "client",
    },
    route: {
      type: String,
      trim: true,
      default: "",
    },
    requestId: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const TelemetryEvent = mongoose.model("TelemetryEvent", telemetryEventSchema);

export default TelemetryEvent;
