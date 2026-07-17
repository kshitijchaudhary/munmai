warning: in the working copy of 'server/middleware/authMiddleware.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'server/package.json', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/server/middleware/authMiddleware.js b/server/middleware/authMiddleware.js[m
[1mindex 46b3d62..bd7c841 100644[m
[1m--- a/server/middleware/authMiddleware.js[m
[1m+++ b/server/middleware/authMiddleware.js[m
[36m@@ -16,18 +16,24 @@[m [mexport const protect = async (req, res, next) => {[m
       // Verify token[m
       const decoded = jwt.verify(token, process.env.JWT_SECRET);[m
 [m
[31m-      // Attach user to request[m
[31m-      req.user = await User.findById(decoded.id).select("-password");[m
[32m+[m[32m      // Attach user to request only when the token still references an account[m
[32m+[m[32m      const user = await User.findById(decoded.id).select("-password");[m
 [m
[31m-      next();[m
[32m+[m[32m      if (!user) {[m
[32m+[m[32m        return res.status(401).json({ message: "Not authorized, token failed" });[m
[32m+[m[32m      }[m
[32m+[m
[32m+[m[32m      req.user = user;[m
[32m+[m
[32m+[m[32m      return next();[m
 [m
     } catch (error) {[m
[31m-      res.status(401).json({ message: "Not authorized, token failed" });[m
[32m+[m[32m      return res.status(401).json({ message: "Not authorized, token failed" });[m
     }[m
 [m
   } else {[m
[31m-    res.status(401).json({ message: "Not authorized, no token" });[m
[32m+[m[32m    return res.status(401).json({ message: "Not authorized, no token" });[m
   }[m
 };[m
 [m
[31m-export default protect;[m
\ No newline at end of file[m
[32m+[m[32mexport default protect;[m
[1mdiff --git a/server/package.json b/server/package.json[m
[1mindex 6c9c50f..7963b9c 100644[m
[1m--- a/server/package.json[m
[1m+++ b/server/package.json[m
[36m@@ -7,6 +7,7 @@[m
   "scripts": {[m
     "dev": "nodemon server.js",[m
     "start": "node server.js",[m
[32m+[m[32m    "test": "node --test",[m
     "backup:json": "node scripts/backupMongo.mjs"[m
   },[m
   "keywords": [],[m
