DROP DATABASE IF EXISTS everyday;
DROP ROLE IF EXISTS everyday;
CREATE ROLE everyday WITH LOGIN PASSWORD 'everydoc';
CREATE DATABASE everyday OWNER everyday;
\c everyday
GRANT ALL ON SCHEMA public TO everyday;
