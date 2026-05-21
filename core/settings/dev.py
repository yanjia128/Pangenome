# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

CORS_ORIGIN_WHITELIST = [
    "http://0.0.0.0:4000",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://140.116.214.140:4000",
    "http://localhost:9000",  # JBrowse server
    "http://127.0.0.1:9000",  # JBrowse server
]
