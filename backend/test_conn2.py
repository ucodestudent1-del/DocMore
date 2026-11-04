import asyncio, asyncpg

async def try_connect(user, password, database, host, port, label):
    try:
        c = await asyncpg.connect(user=user, password=password, database=database, host=host, port=port, ssl="disable")
        print(f"  {label}: CONNECTED OK")
        await c.close()
        return True
    except Exception as e:
        print(f"  {label}: ERROR {type(e).__name__}: {str(e)[:80]}")
        return False

async def main():
    print("Testing asyncpg connections (ssl=disable):")
    await try_connect("everydoc", "everydoc", "everydoc", "127.0.0.1", 5432, "everydoc->everydoc")
    await try_connect("postgres", None, "everydoc", "127.0.0.1", 5432, "postgres->everydoc")
    await try_connect("postgres", None, "postgres", "127.0.0.1", 5432, "postgres->postgres")
    await try_connect("everydoc", "everydoc", "postgres", "127.0.0.1", 5432, "everydoc->postgres")

asyncio.run(main())
