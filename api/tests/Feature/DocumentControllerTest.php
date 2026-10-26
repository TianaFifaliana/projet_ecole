<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_uploads_downloads_and_deletes_a_document(): void
    {
        Storage::fake('local');
        $user = $this->createUserWithRole();
        $student = $this->createStudent();
        Sanctum::actingAs($user);

        $response = $this->post('/api/students/'.$student->id.'/documents', [
            'type' => 'acte_naissance',
            'fichier' => UploadedFile::fake()->create('acte.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('type', 'acte_naissance')
            ->assertJsonPath('nom', 'acte.pdf');

        $document = Document::findOrFail($response->json('id'));
        Storage::disk('local')->assertExists($document->chemin_fichier);

        $this->get('/api/students/'.$student->id.'/documents/'.$document->id.'/download')
            ->assertOk()
            ->assertDownload('acte.pdf');

        $this->deleteJson('/api/students/'.$student->id.'/documents/'.$document->id)
            ->assertOk();

        Storage::disk('local')->assertMissing($document->chemin_fichier);
        $this->assertDatabaseMissing('documents', ['id' => $document->id]);
    }

    public function test_rejects_files_larger_than_five_megabytes(): void
    {
        Storage::fake('local');
        $user = $this->createUserWithRole();
        $student = $this->createStudent();
        Sanctum::actingAs($user);

        $this->post('/api/students/'.$student->id.'/documents', [
            'type' => 'bulletin',
            'fichier' => UploadedFile::fake()->create('bulletin.pdf', 5121, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('fichier');
    }

    public function test_rejects_an_unsupported_document_type(): void
    {
        Storage::fake('local');
        $user = $this->createUserWithRole();
        $student = $this->createStudent();
        Sanctum::actingAs($user);

        $this->post('/api/students/'.$student->id.'/documents', [
            'type' => 'inconnu',
            'fichier' => UploadedFile::fake()->create('fichier.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');
    }

    private function createStudent(): Student
    {
        return Student::create([
            'matricule' => 'E200',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
    }

    private function createUserWithRole(): User
    {
        $role = Role::create([
            'nom' => 'secretariat',
            'permissions' => ['eleves'],
        ]);

        return User::factory()->create(['role_id' => $role->id]);
    }
}
