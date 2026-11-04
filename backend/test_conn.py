import asyncio, asyncpg

async def t():
    try:
        c = await asyncpg.connect(user='postgres', database='postgres', host='127.0.0.1', port=5432)
        print('postgres connected OK')
        r = await c.fetchval("SELECT rolname FROM pg_roles WHERE rolname='everydoc'")
        print("everydoc role visible:", r)
        await c.close()
    except Exception as e:
        print("ERROR:", type(e).__name__, str(e))

    try:
        c2 = await asyncpg.connect(user='everydoc', password='everydoc', database='everydoc', host='127.0.0.1', port=5432)
        print('everydoc connected OK')
        await c2.close()
    except Exception as e:
        print("ERROR everyday:", type(e).__name__, str(e))

asyncio.run(t())
