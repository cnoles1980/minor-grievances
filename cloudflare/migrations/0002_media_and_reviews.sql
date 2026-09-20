CREATE TABLE note_media (
 note_id TEXT PRIMARY KEY REFERENCES notes(id),
 data BLOB NOT NULL CHECK(length(data)<=196608)
);
CREATE TABLE media_budget (id INTEGER PRIMARY KEY CHECK(id=1), bytes INTEGER NOT NULL);
INSERT INTO media_budget VALUES(1,0);
CREATE TRIGGER media_capacity BEFORE INSERT ON note_media WHEN (SELECT bytes FROM media_budget WHERE id=1)+length(NEW.data)>67108864 BEGIN
 SELECT RAISE(ABORT, 'media_capacity');
END;
CREATE TRIGGER media_added AFTER INSERT ON note_media BEGIN
 UPDATE media_budget SET bytes=bytes+length(NEW.data) WHERE id=1;
END;
CREATE TRIGGER media_removed AFTER DELETE ON note_media BEGIN
 UPDATE media_budget SET bytes=bytes-length(OLD.data) WHERE id=1;
END;

CREATE TABLE moderation_cases (
 note_id TEXT PRIMARY KEY REFERENCES notes(id),
 id TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','keep','remove')),
 expires INTEGER NOT NULL DEFAULT 0,
 decided INTEGER,
 decision_nonce TEXT
);
-- Only a newly inserted report opens/reopens a case; duplicate clicks do not.
CREATE TRIGGER report_opens_case AFTER INSERT ON reports BEGIN
 INSERT INTO moderation_cases(note_id,id) VALUES(NEW.note_id,lower(hex(randomblob(16))))
 ON CONFLICT(note_id) DO UPDATE SET
 id=CASE WHEN state='open' THEN id ELSE excluded.id END,
 expires=CASE WHEN state='open' THEN expires ELSE 0 END,
 state='open',decided=NULL,decision_nonce=NULL;
END;
-- Preserve pre-existing report history and queue only visible reported notes.
INSERT INTO moderation_cases(note_id,id)
 SELECT DISTINCT r.note_id,lower(hex(randomblob(16))) FROM reports r JOIN notes n ON n.id=r.note_id WHERE n.hidden=0
 GROUP BY r.note_id;
