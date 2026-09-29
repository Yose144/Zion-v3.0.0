#!/usr/bin/env python3
import http.client
import json
import os
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g8_alert_sink as sink


def sample_payload(**kw):
    payload = {
        "version": "4",
        "status": "firing",
        "receiver": "g8-webhook",
        "groupKey": "grp-1",
        "externalURL": "http://should-not-persist.example",
        "alerts": [
            {
                "status": "firing",
                "fingerprint": "fp-node-down",
                "labels": {"alertname": "NodeDown", "service": "node_primary"},
                "annotations": {"summary": "primary node down"},
                "startsAt": "2026-09-29T12:00:00.000Z",
                "endsAt": "0001-01-01T00:00:00Z",
            }
        ],
    }
    payload.update(kw)
    return payload


class SinkTestBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.events = os.path.join(self.tmp.name, "events.jsonl")
        self.state = os.path.join(self.tmp.name, "state.json")
        cfg = {"host": "127.0.0.1", "port": 0,
               "events_file": self.events, "state_file": self.state,
               "max_body": 4096}
        self.srv = sink.make_server(cfg)
        self.port = self.srv.server_address[1]
        self.thread = threading.Thread(target=self.srv.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.srv.shutdown)
        self.addCleanup(self.srv.server_close)

    def request(self, method, path, body=None, headers=None, raw=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        if raw is not None:
            conn.request(method, path, body=raw)
        else:
            h = {"Content-Type": "application/json"}
            if headers:
                h.update(headers)
            conn.request(method, path, body=body, headers=h)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, data

    def post(self, payload, headers=None):
        return self.request("POST", "/alerts", body=json.dumps(payload), headers=headers)

    def read_events(self):
        if not os.path.exists(self.events):
            return []
        with open(self.events) as f:
            return [json.loads(l) for l in f if l.strip()]

    def read_state(self):
        with open(self.state) as f:
            return json.load(f)


class HttpTests(SinkTestBase):
    def test_health(self):
        st, data = self.request("GET", "/health")
        self.assertEqual(st, 200)
        self.assertEqual(json.loads(data), {"status": "ok", "service": "zion-g8-alert-sink"})

    def test_get_404(self):
        st, _ = self.request("GET", "/alerts")
        self.assertEqual(st, 404)
        st, _ = self.request("GET", "/nope")
        self.assertEqual(st, 404)

    def test_post_wrong_path_404(self):
        st, _ = self.request("POST", "/other", body="{}")
        self.assertEqual(st, 404)

    def test_bad_content_type(self):
        st, _ = self.request("POST", "/alerts", body="{}", headers={"Content-Type": "text/plain"})
        self.assertEqual(st, 400)

    def test_missing_content_length(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.putrequest("POST", "/alerts", skip_host=False, skip_accept_encoding=True)
        conn.putheader("Content-Type", "application/json")
        conn.endheaders()
        resp = conn.getresponse()
        resp.read()
        conn.close()
        self.assertEqual(resp.status, 400)

    def test_zero_content_length(self):
        st, _ = self.request("POST", "/alerts", body="{}",
                             headers={"Content-Length": "0"})
        self.assertEqual(st, 400)

    def test_body_too_large(self):
        st, _ = self.request("POST", "/alerts", body=" " * 4097)
        self.assertEqual(st, 413)

    def test_invalid_json(self):
        st, _ = self.request("POST", "/alerts", body="{not json")
        self.assertEqual(st, 400)

    def test_wrong_shape(self):
        st, _ = self.post({"alerts": "notalist"})
        self.assertEqual(st, 400)
        st, _ = self.post({"alerts": [{"labels": {"service": "x"}, "status": "firing"}]})
        self.assertEqual(st, 400)
        st, _ = self.post("[]")
        self.assertEqual(st, 400)
        st, _ = self.post({"status": "exploding", "alerts": []})
        self.assertEqual(st, 400)


class PersistenceTests(SinkTestBase):
    def test_firing_writes_event_and_active(self):
        st, data = self.post(sample_payload())
        self.assertEqual(st, 200)
        self.assertTrue(json.loads(data)["ok"])
        events = self.read_events()
        self.assertEqual(len(events), 1)
        state = self.read_state()
        self.assertEqual(state["schema_version"], 1)
        self.assertEqual(len(state["active_alerts"]), 1)
        a = state["active_alerts"][0]
        self.assertEqual(a["fingerprint"], "fp-node-down")
        self.assertEqual(a["status"], "firing")
        self.assertEqual(a["labels"]["alertname"], "NodeDown")
        self.assertTrue(a["received_at"])
        self.assertEqual(len(state["seen_event_ids"]), 1)
        self.assertEqual(state["seen_event_ids"][0], events[0]["event_id"])
        ev = events[0]
        for k in ("event_id", "received_at", "status", "group_key", "receiver", "alerts"):
            self.assertIn(k, ev)
        self.assertNotIn("externalURL", json.dumps(ev))
        self.assertEqual(oct(os.stat(self.state).st_mode & 0o777), "0o600")
        self.assertEqual(oct(os.stat(self.events).st_mode & 0o777), "0o600")

    def test_duplicate_idempotent(self):
        self.post(sample_payload())
        st, data = self.post(sample_payload())
        self.assertEqual(st, 200)
        self.assertTrue(json.loads(data).get("deduplicated"))
        self.assertEqual(len(self.read_events()), 1)
        self.assertEqual(len(self.read_state()["active_alerts"]), 1)

    def test_resolved_removes_and_appends(self):
        self.post(sample_payload())
        p = sample_payload(status="resolved")
        p["alerts"][0]["status"] = "resolved"
        st, _ = self.post(p)
        self.assertEqual(st, 200)
        self.assertEqual(len(self.read_events()), 2)
        self.assertEqual(self.read_state()["active_alerts"], [])

    def test_two_fingerprints_sorted(self):
        p = sample_payload()
        p["alerts"].append({
            "status": "firing",
            "fingerprint": "aa-first",
            "labels": {"alertname": "OtherAlert", "service": "dao"},
            "annotations": {},
        })
        self.post(p)
        fps = [a["fingerprint"] for a in self.read_state()["active_alerts"]]
        self.assertEqual(fps, sorted(fps))
        self.assertEqual(fps, ["aa-first", "fp-node-down"])

    def test_fallback_fingerprint_stable(self):
        p = sample_payload()
        del p["alerts"][0]["fingerprint"]
        st, _ = self.post(p)
        self.assertEqual(st, 200)
        fp1 = self.read_state()["active_alerts"][0]["fingerprint"]
        self.assertEqual(len(fp1), 64)
        self.post(p)
        self.assertEqual(len(self.read_events()), 1)

    def test_caps_and_stringify(self):
        self.srv.max_body = 1 << 20
        p = sample_payload()
        p["alerts"][0]["labels"]["big"] = "x" * 5000
        p["alerts"][0]["labels"]["num"] = 42
        p["alerts"][0]["annotations"]["huge"] = "y" * 9000
        p["alerts"][0]["fingerprint"] = "f" * 300
        p["alerts"][0]["startsAt"] = "s" * 500
        st, _ = self.post(p)
        self.assertEqual(st, 200)
        a = self.read_state()["active_alerts"][0]
        self.assertEqual(len(a["labels"]["big"]), 1024)
        self.assertEqual(a["labels"]["num"], "42")
        self.assertEqual(len(a["annotations"]["huge"]), 4096)
        self.assertEqual(len(a["fingerprint"]), 128)
        self.assertEqual(len(a["starts_at"]), 128)

    def test_corrupt_state_fails_closed(self):
        self.post(sample_payload())
        with open(self.state, "w") as f:
            f.write("{corrupt json!!!")
        st, _ = self.post(sample_payload(status="firing",
                                       alerts=[{"status": "firing", "fingerprint": "fp2",
                                                "labels": {"alertname": "B"},
                                                "annotations": {}}]))
        self.assertEqual(st, 200)
        state = self.read_state()
        self.assertEqual([a["fingerprint"] for a in state["active_alerts"]], ["fp2"])
        self.assertEqual(state["schema_version"], 1)

    def test_state_write_failure_retry_no_dup_event(self):
        self.assertEqual(self.post(sample_payload())[0], 200)
        p = sample_payload(groupKey="grp-2",
                           alerts=[{"status": "firing", "fingerprint": "fp3",
                                    "labels": {"alertname": "C"}, "annotations": {}}])
        orig = sink.write_state_atomic
        sink.write_state_atomic = lambda *a, **k: (_ for _ in ()).throw(OSError("boom"))
        try:
            st, _ = self.post(p)
            self.assertEqual(st, 500)
        finally:
            sink.write_state_atomic = orig
        self.assertEqual(len(self.read_events()), 2)
        st, _ = self.post(p)
        self.assertEqual(st, 200)
        events = self.read_events()
        self.assertEqual(len(events), 2)
        self.assertEqual(events[1]["event_id"], events[-1]["event_id"])
        fps = [a["fingerprint"] for a in self.read_state()["active_alerts"]]
        self.assertEqual(fps, ["fp-node-down", "fp3"])

    def test_per_alert_status_fallback(self):
        p = sample_payload(status="firing")
        del p["alerts"][0]["status"]
        st, _ = self.post(p)
        self.assertEqual(st, 200)
        p2 = sample_payload(status="firing")
        p2["alerts"][0]["status"] = "garbage"
        st, _ = self.post(p2)
        self.assertEqual(st, 400)


if __name__ == "__main__":
    unittest.main()
