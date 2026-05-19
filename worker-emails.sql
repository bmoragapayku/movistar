-- ============================================================
-- PAYKU MOVISTAR ARENA · Actualización de emails de trabajadores
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

UPDATE movistar_workers SET email = 'abel@payku.com'                    WHERE name ILIKE '%Abel%Salazar%';
UPDATE movistar_workers SET email = 'andrea@payku.com'                  WHERE name ILIKE '%Andrea%Concha%';
UPDATE movistar_workers SET email = 'andy@payku.com'                    WHERE name ILIKE '%Andy%Hormazabal%';
UPDATE movistar_workers SET email = 'brian@payku.com'                   WHERE name ILIKE '%Brian%Moraga%';
UPDATE movistar_workers SET email = 'camilo@payku.com'                  WHERE name ILIKE '%Camilo%' AND (name ILIKE '%Mu%oz%' OR name ILIKE '%Munoz%');
UPDATE movistar_workers SET email = 'daniel@payku.com'                  WHERE name ILIKE '%Daniel%Rico%';
UPDATE movistar_workers SET email = 'danielnaranjo@payku.com'           WHERE name ILIKE '%Daniel%Naranjo%';
UPDATE movistar_workers SET email = 'david@payku.cl'                    WHERE name ILIKE '%David%Pineda%';
UPDATE movistar_workers SET email = 'euridice@payku.com'                WHERE name ILIKE '%Euridice%Landaeta%';
UPDATE movistar_workers SET email = 'fer@payku.cl'                      WHERE name ILIKE '%Fernando%Mayr%';
UPDATE movistar_workers SET email = 'frank@payku.com'                   WHERE name ILIKE '%Frank%Lobo%';
UPDATE movistar_workers SET email = 'freddy@payku.com'                  WHERE name ILIKE '%Freddy%Lobo%';
UPDATE movistar_workers SET email = 'gen@payku.com'                     WHERE name ILIKE '%Genecis%Medina%';
UPDATE movistar_workers SET email = 'jesus@payku.com'                   WHERE name ILIKE '%Jes%s%Cova%';
UPDATE movistar_workers SET email = 'jorge@payku.com'                   WHERE name ILIKE '%Jorge%Gonz%lez%' OR name ILIKE '%Jorge%Gonzalez%';
UPDATE movistar_workers SET email = 'kristina@payku.com'                WHERE name ILIKE '%Kristina%Guido%';
UPDATE movistar_workers SET email = 'luis@payku.com'                    WHERE name ILIKE '%Luis%Loyola%';
UPDATE movistar_workers SET email = 'marisol@payku.com'                 WHERE name ILIKE '%Marisol%Troncoso%';
UPDATE movistar_workers SET email = 'rayli@payku.com'                   WHERE name ILIKE '%Raylimar%Mardones%';
UPDATE movistar_workers SET email = 'roberto@payku.com'                 WHERE name ILIKE '%Roberto%Donoso%';
UPDATE movistar_workers SET email = 'ronald@payku.com'                  WHERE name ILIKE '%Ronald%Peraza%';
UPDATE movistar_workers SET email = 'alex@payku.com'                    WHERE name ILIKE '%Roswar%Urbina%';
UPDATE movistar_workers SET email = 'tmoreno@payku.com'                 WHERE name ILIKE '%Trinidad%Moreno%';
UPDATE movistar_workers SET email = 'vanessa@payku.com'                 WHERE name ILIKE '%Vanessa%S%nchez%' OR name ILIKE '%Vanessa%Sanchez%';
UPDATE movistar_workers SET email = 'victor@payku.com'                  WHERE name ILIKE '%V%ctor%Espinoza%' OR name ILIKE '%Victor%Espinoza%';
UPDATE movistar_workers SET email = 'yesicagonzalez2594@gmail.com'      WHERE name ILIKE '%Yesica%Gonz%lez%' OR name ILIKE '%Yesica%Gonzalez%';

-- Verificar resultados
SELECT name, email FROM movistar_workers ORDER BY name;
