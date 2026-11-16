"""Vues du site : la page unique et l'API des protéines."""

from django.db.models import Q
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from django.shortcuts import render


from .models import Protein
from .settings import STATIC_DIR

# Nombre maximum de protéines renvoyées, pour garder la réponse légère.
MAX_RESULTS = 50

# Pages secondaires ouvertes par le menu de gauche, servies telles quelles.
PAGES = ('proteins', 'protein', 'stress')


@require_GET
def index(request):
    """Renvoie static/index.html tel quel (pas de moteur de template)."""
    html = (STATIC_DIR / 'index.html').read_text(encoding='utf-8')
    return HttpResponse(html, content_type='text/html; charset=utf-8')


@require_GET
def page(request, name):
    """Sert static/pages/<name>.html (Guide, Data, About, Proteins)."""
    if name not in PAGES:
        raise Http404('Unknown page')

    html = (STATIC_DIR / 'pages' / f'{name}.html').read_text(encoding='utf-8')
    return HttpResponse(html, content_type='text/html; charset=utf-8')


@require_GET
def proteins(request):
    """GET /api/proteins/?q=<terme>&id=<n>

    `q` filtre sur le nom, l'identifiant UniProt et la description ; `id`
    renvoie un seul enregistrement. Répond toujours la même forme :
        {"query": "...", "count": 6, "results": [ {...}, ... ]}
    """
    query = (request.GET.get('q') or '').strip()
    protein_id = (request.GET.get('id') or '').strip()

    proteins = Protein.objects.all()
    if protein_id:
        if not protein_id.isdigit():
            return JsonResponse({'error': 'id must be a positive integer'}, status=400)
        proteins = proteins.filter(pk=int(protein_id))
    if query:
        proteins = proteins.filter(
            Q(name__icontains=query)
            | Q(uniprot_id__icontains=query)
            | Q(description__icontains=query)
        )

    results = [
        {
            'id': protein.id,
            'name': protein.name,
            'uniprot_id': protein.uniprot_id,
            'description': protein.description,
            'molecular_weight_kda': protein.molecular_weight_kda,
        }
        for protein in proteins[:MAX_RESULTS]
    ]

    return JsonResponse({'query': query, 'count': len(results), 'results': results})



def protein_view(request):
    context = {
        'cif_url': '/static/data/9RKP.cif'
    }

    return render(request, 'protein.html', context)